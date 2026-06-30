# MCP-SERVER

这是一个 TypeScript + Express 项目，用来承载后续的 MCP 服务。

当前已经包含健康检查、阿里云日志 HTTP 调试接口，以及 Streamable HTTP MCP 服务。

## 服务规划

- MySQL 元数据 MCP 服务：后续用于告诉大模型某个 MySQL 实例有哪些表、表结构是什么、字段含义是什么，以及是否需要补充索引等建议。
- 阿里云日志 MCP 服务：后续用于封装阿里云日志相关能力。

## 本地启动

```bash
npm install
npm run dev
```

默认端口是 `3000`，可以通过 `.env` 修改：

```bash
cp .env.example .env
```

## 健康检查

```bash
curl http://localhost:3000/health
```

预期返回：

```json
{
  "status": "ok",
  "service": "mcp-server"
}
```

## 阿里云日志调试接口

这里是阿里云日志服务 `ListProject` API 的 HTTP 调试入口，方便本地直接用浏览器或 `curl` 验证。

先复制本地环境变量文件：

```bash
cp .env.example .env.local
```

然后填写：

```bash
ALIYUN_LOG_ACCESS_KEY_ID=
ALIYUN_LOG_ACCESS_KEY_SECRET=
ALIYUN_LOG_REGION=cn-hangzhou
ALIYUN_LOG_DEFAULT_ENVIRONMENT=test
ALIYUN_LOG_ENVIRONMENTS={"test":{"projectName":"k8s-dev","logstoreName":"test"},"staging":{"projectName":"k8s-staging","logstoreName":"staging"}}
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

`.env.example` 是提交到 Git 的模板，不放真实密钥。`.env.local` 是本机真实配置，已经被 `.gitignore` 忽略，不会上传到 GitHub。

`ALIYUN_LOG_RETURN_FIELDS` 用来控制每条日志返回哪些字段，不配置时返回阿里云原始日志的全部字段。配置时填写阿里云原始字段名，例如：

```text
time,level,_container_name_,_pod_name_,_namespace_,content
```

字段名要和阿里云返回保持一致，例如服务名字段是 `_container_name_`，不是 `containerName`。如果要调试字段，可以先不配置 `ALIYUN_LOG_RETURN_FIELDS`，这样会返回原始日志的全部字段。

```bash
ALIYUN_LOG_RETURN_FIELDS=time,level,_container_name_,_pod_name_,_namespace_,content,__time__
```

启动服务：

```bash
npm run dev
```

查询当前账号在指定区域下能访问的 Project：

```bash
curl "http://localhost:3000/aliyun-log/projects"
```

如果请求里不传 `projectName`，接口会查询当前区域下全部 Project。

按 Project 名称模糊过滤：

```bash
curl "http://localhost:3000/aliyun-log/projects?projectName=k8s"
```

查询某个 Project 下的 Logstore：

```bash
curl "http://localhost:3000/aliyun-log/projects/k8s-dev/logstores"
```

按 Logstore 名称模糊过滤：

```bash
curl "http://localhost:3000/aliyun-log/projects/k8s-dev/logstores?logstoreName=test"
```

查询某个 Project + Logstore 最近 5 分钟日志：

```bash
curl "http://localhost:3000/aliyun-log/projects/k8s-dev/logstores/test/logs"
```

按环境查询最近 5 分钟日志。`environment` 不传时默认使用 `ALIYUN_LOG_DEFAULT_ENVIRONMENT`，当前默认是 `test`：

```bash
curl "http://localhost:3000/aliyun-log/logs"
```

指定环境查询：

```bash
curl "http://localhost:3000/aliyun-log/logs?environment=staging"
```

查询最近 5 分钟 ERROR 日志：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=test" \
  --data-urlencode "level=error" \
  --data-urlencode "minutes=5" \
  --data-urlencode "pageNumber=1" \
  --data-urlencode "pageSize=50"
```

查询两个服务的日志：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=test" \
  --data-urlencode "containerNames=order-service,pay-service" \
  --data-urlencode "minutes=5"
```

查询两个服务的 ERROR 日志：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=test" \
  --data-urlencode "containerNames=order-service,pay-service" \
  --data-urlencode "level=error" \
  --data-urlencode "minutes=5"
```

查询 traceId 链路：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=test" \
  --data-urlencode "traceId=b03a2133ebe048ccae56cb40125bb53d.574.17827209165150053"
```

传 `traceId` 且不传 `from/to/minutes` 时，默认查最近 7 天，也就是 `ALIYUN_LOG_TRACE_DEFAULT_QUERY_MINUTES=10080`。

查询 traceId 的某个日志级别：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=test" \
  --data-urlencode "traceId=b03a2133ebe048ccae56cb40125bb53d.574.17827209165150053" \
  --data-urlencode "level=info"
```

`query` 可以和结构化参数混用，服务端会用 `and` 拼成最终查询语句。例如：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=test" \
  --data-urlencode "query=TimeoutException" \
  --data-urlencode "containerNames=order-service,pay-service" \
  --data-urlencode "level=error" \
  --data-urlencode "keywords=database,slow sql" \
  --data-urlencode "minutes=5"
```

最终会拼成类似：

```text
(TimeoutException) and (_container_name_: order-service or _container_name_: pay-service) and level: error and content: "database" and content: "slow sql"
```

分页查询第二页时，不要重新传 `minutes`。如果上一页返回了 `nextPage`，直接复用里面的 `from/to/query/pageSize/reverse`，只使用它给出的下一页页码。

上一页返回示例：

```json
{
  "page": {
    "pageNumber": 1,
    "pageSize": 50,
    "offset": 0,
    "hasMore": true
  },
  "nextPage": {
    "environment": "test",
    "query": "level: error",
    "from": 1719390000,
    "to": 1719390900,
    "pageNumber": 2,
    "pageSize": 50,
    "reverse": true
  }
}
```

然后按 `nextPage` 查询第二页：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=test" \
  --data-urlencode "query=level: error" \
  --data-urlencode "from=1719390000" \
  --data-urlencode "to=1719390900" \
  --data-urlencode "pageNumber=2" \
  --data-urlencode "pageSize=50"
```

也可以用 Unix 秒级时间戳指定时间范围：

```bash
curl "http://localhost:3000/aliyun-log/projects/k8s-dev/logstores/test/logs?query=level:%20ERROR&from=1719390000&to=1719390900"
```

注意：`query` 里如果包含 `|`，阿里云会把它当分析语句处理，普通 `line/offset` 分页可能会被忽略。这种情况建议在 SQL 里自己写 `limit/offset`。

## MCP 服务

当前提供一个 Streamable HTTP MCP 服务，路径是：

```text
POST /mcp
```

MCP 使用 stateful Streamable HTTP：

- 初始化请求会返回 `mcp-session-id`。
- 后续 `POST /mcp` 需要带同一个 `mcp-session-id`。
- `GET /mcp` 使用同一个 `mcp-session-id` 建立 SSE 长连接，用于接收服务端通知。
- `DELETE /mcp` 使用同一个 `mcp-session-id` 终止会话。

当前注册的工具：

```text
aliyun_log_list_projects
aliyun_log_list_logstores
aliyun_log_query_logs
```

这些工具复用阿里云日志 API，用来查询当前账号在指定区域下可访问的 Project、Logstore，以及指定 Logstore 下的日志。

启动服务：

```bash
npm run dev
```

工具参数：

```json
{
  "projectName": "k8s",
  "offset": 0,
  "size": 100
}
```

`projectName` 不传时，会查询当前区域下全部 Project。工具执行期间会发送开始和完成两条 logging notification，MCP 客户端建立 `GET /mcp` 长连接后可以收到这些服务端通知。

`aliyun_log_list_logstores` 工具参数：

```json
{
  "projectName": "k8s-dev",
  "logstoreName": "test",
  "offset": 0,
  "size": 200
}
```

`aliyun_log_query_logs` 工具参数：

```json
{
  "environment": "test",
  "query": "(_container_name_: order-service or _container_name_: pay-service) and level: error",
  "minutes": 5,
  "pageNumber": 1,
  "pageSize": 50,
  "reverse": true
}
```

`environment` 不传时默认查 `test`。如果要临时绕过环境映射，也可以同时传 `projectName` 和 `logstoreName`，但不能和 `environment` 混用。

常用查询字段：

- 服务名：`_container_name_`
- 日志级别：`level`
- 日志级别取值：`info`、`warn`、`error`
- traceId：`content`

时间参数有两种写法：

1. 传 `minutes`，表示查询最近 N 分钟。
2. 同时传 `from` 和 `to`，表示查询固定 Unix 秒级时间范围。

如果两种都不传，有 `traceId` 时默认查询最近 7 天；有普通 `query` 或结构化服务/level/keyword 条件时默认查询最近 15 分钟；空查询时默认查询最近 5 分钟。空查询最大只允许查 5 分钟，避免一次性扫太多日志。

## 常用命令

```bash
npm run typecheck
npm run build
npm start
```

## 代码结构

- `src/server.ts`：进程入口，负责监听端口。
- `src/app.ts`：Express 应用组装入口。
- `src/config/env.ts`：环境变量读取和校验。
- `src/routes/health.ts`：健康检查路由。
- `src/mcp-services/mysql-metadata`：MySQL 元数据 MCP 服务预留目录。
- `src/mcp-services/aliyun-log`：阿里云日志 API 接入模块，当前实现 `ListProject`、`ListLogStores` 和 `GetLogsV2`。

## Review TS 代码的建议流程

你对 TypeScript 还不熟，所以每次看 AI 生成的 TS 代码，建议按下面顺序 review：

1. 先看 `package.json`：确认新增依赖是不是必要，脚本命令是否清楚。
2. 再看入口文件：本项目先看 `src/server.ts`，确认服务从哪里启动、监听哪个端口。
3. 再看应用组装：看 `src/app.ts`，确认中间件、路由注册、返回结构是否符合预期。
4. 再看配置读取：看 `src/config/env.ts`，确认环境变量有没有默认值、有没有基本校验。
5. 再看具体路由：看 `src/routes/health.ts` 和 `src/mcp-services/aliyun-log/routes.ts`，确认接口路径、入参、返回 JSON。
6. 再看 MCP 注册：看 `src/mcp-server.ts`，确认工具名、参数、调用的服务函数和返回内容。
7. 跑一遍命令：`npm run typecheck`、`npm run build`。

如果你不确定某段 TS，可以重点问三个问题：

- 这个文件对外暴露了什么？
- 这个函数接收什么输入，返回什么输出？
- 这里失败时会发生什么？
