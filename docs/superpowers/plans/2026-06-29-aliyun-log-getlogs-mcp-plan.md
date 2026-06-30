# 阿里云日志 GetLogsV2 MCP 分阶段计划

## 目标

基于阿里云日志服务 `GetLogsV2` API，提供可用于生产环境的 MCP 日志查询能力。整体目标不是简单透传接口，而是让大模型可以安全、稳定、分页地查询生产日志，并逐步支持常见排障场景。

## 现状

当前项目已经具备：

- 查询当前账号可访问的 Project：`aliyun_log_list_projects`
- 查询某个 Project 下的 Logstore：`aliyun_log_list_logstores`
- Streamable HTTP MCP 服务：`POST /mcp`
- Stateful session：支持 `mcp-session-id`
- SSE 长连接：支持服务端 logging notification

下一步要接入的是阿里云 `GetLogsV2` API。

## 总体原则

- 生产环境必须限制单次返回量，但要支持分页继续查询。
- 查询必须有明确的 Project、Logstore 和时间范围。
- 普通非空查询默认最近 15 分钟，traceId 查询默认最近 7 天，最大时间范围通过配置控制。
- 单页最多 100 条，符合 `GetLogsV2` 的 `line` 最大值。
- 不直接把 SDK 原始响应丢给大模型，要整理成稳定结构。
- 错误返回要标准化，方便定位权限、参数、索引、超时等问题。
- 后续所有排障工具都复用底层 `queryLogs` 能力。

## V1：生产可用的 GetLogsV2 查询底座

### 要做什么

新增 MCP 工具：

```text
aliyun_log_query_logs
```

新增 HTTP 调试接口：

```text
GET /aliyun-log/projects/:projectName/logstores/:logstoreName/logs
```

### 工具参数

```ts
{
  projectName: string;
  logstoreName: string;
  query?: string;
  from?: number;
  to?: number;
  minutes?: number;
  pageNumber?: number;
  pageSize?: number;
  reverse?: boolean;
}
```

### 参数规则

- `projectName` 必填。
- `logstoreName` 必填。
- `from/to` 和 `minutes` 二选一。
- 如果都不传，普通非空查询默认最近 15 分钟，traceId 查询默认最近 7 天，空查询默认最近 5 分钟。
- `pageNumber` 默认 1。
- `pageSize` 默认 50，最大 100。
- `reverse` 默认 `true`，优先返回最新日志。
- 空 `query` 允许，但空查询的最大时间范围更小。
- 非空 `query` 也必须受最大时间范围限制。

### 配置项

```bash
ALIYUN_LOG_DEFAULT_QUERY_MINUTES=15
ALIYUN_LOG_MAX_QUERY_MINUTES=30
ALIYUN_LOG_EMPTY_QUERY_MAX_MINUTES=5
ALIYUN_LOG_TRACE_DEFAULT_QUERY_MINUTES=10080
ALIYUN_LOG_TRACE_MAX_QUERY_MINUTES=10080
ALIYUN_LOG_TRACE_MIN_LENGTH=16
ALIYUN_LOG_DEFAULT_PAGE_SIZE=50
ALIYUN_LOG_MAX_PAGE_SIZE=100
ALIYUN_LOG_RETURN_FIELDS=time,level,_container_name_,_pod_name_,_namespace_,content
```

`ALIYUN_LOG_RETURN_FIELDS` 不配置时，每条日志返回阿里云原始日志的全部字段；配置后只返回列出的原始字段名。例如服务名字段应配置 `_container_name_`，而不是 `containerName`。

### 返回结构

```ts
{
  projectName: string;
  logstoreName: string;
  from: number;
  to: number;
  query: string;
  reverse: boolean;
  page: {
    pageNumber: number;
    pageSize: number;
    offset: number;
    hasMore: boolean;
  };
  count: number;
  logs: Array<Record<string, unknown>>;
}
```

### 验收标准

- 可以通过 HTTP 接口查询指定 Project + Logstore 的日志。
- 可以通过 MCP 工具查询同样的数据。
- 不传时间时，普通非空查询默认最近 15 分钟，traceId 查询默认最近 7 天，空查询默认最近 5 分钟。
- `pageNumber/pageSize` 能正确转换成 `offset/line`。
- 超过最大时间范围会返回明确错误。
- 超过最大 `pageSize` 会返回明确错误。
- 编译通过：`npm run typecheck`、`npm run build`。

## V2：环境映射和查询语法规范化

### 要做什么

不新增多个固定排障工具，而是增强现有的通用查询工具：

```text
aliyun_log_query_logs
```

原因是日常排障主要是直接写阿里云日志查询语句，例如按服务、日志级别、traceId 查询。MCP 服务要做的是稳定地提供环境映射、默认环境、字段说明和查询边界，而不是把每一种查询都拆成一个新工具。

### 环境映射

不同环境对应不同的 Project 和 Logstore。环境映射放在 MCP 服务配置里，而不是只写在 agent skill 或 prompt 里。

配置示例：

```bash
ALIYUN_LOG_DEFAULT_ENVIRONMENT=test
ALIYUN_LOG_ENVIRONMENTS={"test":{"projectName":"k8s-dev","logstoreName":"test"},"staging":{"projectName":"k8s-staging","logstoreName":"staging"}}
```

工具参数优先使用：

```ts
{
  environment?: string;
  query?: string;
  minutes?: number;
  pageNumber?: number;
  pageSize?: number;
}
```

规则：

- `environment` 不传时默认使用 `ALIYUN_LOG_DEFAULT_ENVIRONMENT`。
- 默认环境是 `test`。
- 如果传了不存在的 `environment`，MCP 服务直接返回明确错误。
- 临时调试时仍允许直接传 `projectName + logstoreName`。
- `environment` 不能和 `projectName/logstoreName` 混用，避免目标不清楚。

### 查询语法规范

需要在工具 description、README 和后续 skill 里固化这些字段：

```text
服务字段：_container_name_
日志级别字段：level
日志级别取值：info / warn / error
traceId 字段：content
```

常用查询模板：

```text
_container_name_: order-service
```

多个服务：

```text
(_container_name_: order-service or _container_name_: pay-service)
```

多个服务的错误日志：

```text
(_container_name_: order-service or _container_name_: pay-service) and level: error
```

traceId 链路：

```text
content: "b03a2133ebe048ccae56cb40125bb53d.574.17827209165150053"
```

traceId + 日志级别：

```text
content: "b03a2133ebe048ccae56cb40125bb53d.574.17827209165150053" and level: info
```

### 验收标准

- `aliyun_log_query_logs` 支持只传 `environment + query`。
- `aliyun_log_query_logs` 支持结构化查询参数：`containerNames`、`level`、`traceId`、`keywords`。
- `query` 可以和结构化查询参数混用，服务端用 `and` 拼接最终 query。
- 原始 `query` 会用括号包裹，避免和自动拼接条件出现优先级歧义。
- 不传 `environment` 时默认查 `test`。
- 传不存在的环境会返回明确错误，并列出允许的环境。
- 可以继续用 `projectName + logstoreName` 做临时调试。
- README 和工具 description 包含服务、level、traceId 的查询模板。

## V3：生产安全增强

### 要做什么

补齐生产环境需要的安全和治理能力。

能力包括：

- Project 白名单。
- Logstore 白名单。
- 不同 Project 配置不同最大查询时间范围。
- 查询审计日志。
- 敏感字段脱敏。
- 查询超时控制。
- 返回内容长度限制。
- 禁止高风险查询组合。

### 建议配置

```bash
ALIYUN_LOG_ALLOWED_PROJECTS=k8s-dev,k8s-prod
ALIYUN_LOG_ALLOWED_LOGSTORES=test,test-user-platform
ALIYUN_LOG_QUERY_TIMEOUT_MS=10000
ALIYUN_LOG_MAX_CONTENT_LENGTH=2000
ALIYUN_LOG_AUDIT_ENABLED=true
```

### 脱敏范围

优先处理：

- `authorization`
- `token`
- `accessToken`
- `refreshToken`
- 手机号
- 身份证
- 邮箱

### 验收标准

- 未在白名单里的 Project / Logstore 不允许查询。
- 查询参数、时间范围、返回条数都会记录审计日志。
- 敏感字段不会原样返回给 MCP 客户端。
- 查询超时有明确错误。

## V4：查询体验增强

### 要做什么

增强现有 `aliyun_log_query_logs`，不新增独立 query 构造工具。工具同时支持直接传 `query` 和结构化查询参数，由 MCP 服务自动拼接最终 query。

结构化参数：

```ts
{
  containerNames?: string[];
  level?: "info" | "warn" | "error";
  traceId?: string;
  keywords?: string[];
}
```

拼接规则：

- `query`：如果传了，会被包成 `(query)`。
- `containerNames`：一个服务拼成 `_container_name_: service`；多个服务拼成 `(_container_name_: service1 or _container_name_: service2)`。
- `level`：拼成 `level: error`。
- `traceId`：拼成 `content: "traceId"`。
- `keywords`：每个关键字拼成 `content: "keyword"`，多个关键字之间用 `and`。
- 所有条件最终用 `and` 连接。

示例：

```json
{
  "query": "TimeoutException",
  "containerNames": ["order-service", "pay-service"],
  "level": "error",
  "keywords": ["database", "slow sql"]
}
```

最终 query：

```text
(TimeoutException) and (_container_name_: order-service or _container_name_: pay-service) and level: error and content: "database" and content: "slow sql"
```

### 验收标准

- 简单服务查询可以只传 `containerNames`。
- 错误日志查询可以只传 `containerNames + level`。
- trace 查询可以只传 `traceId`，可叠加 `level`。
- 高级查询仍可直接传 `query`，并能和结构化参数混用。
- `nextPage.query` 返回最终拼接后的 query，翻页时不需要重新拼接。

## V5：诊断增强

### 要做什么

在安全查询基础上增加面向排障的聚合和摘要能力。

能力包括：

- 错误日志按服务聚合。
- 错误日志按异常类型聚合。
- trace 日志按时间排序。
- 找出最早错误。
- 找出错误最多的服务。
- 返回排障摘要。
- 根据 Logstore 索引信息提示查询建议。

### 可能新增工具

```text
aliyun_log_summarize_errors
aliyun_log_analyze_trace
aliyun_log_suggest_query_fields
```

### 验收标准

- 能给出结构化排障摘要。
- 摘要必须附带来源日志样例。
- 不在没有证据的情况下给确定性根因结论。
- 对缺少索引字段的查询给出提示。

## 推荐执行顺序

1. 先实现 V1：`aliyun_log_query_logs`。
2. 用真实 Project / Logstore 验证 GetLogsV2 权限、query 语法和分页。
3. 再实现 V2 的环境映射和查询语法规范化。
4. 在生产环境开放前完成 V3 的白名单、审计和脱敏。
5. 最后实现 V4 的聚合和诊断能力。

## 当前下一步

下一步建议开始实现 V1：

```text
aliyun_log_query_logs
```

它是后续所有日志查询和排障工具的底座。
