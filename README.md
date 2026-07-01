# aliyun-sls-mcp-server

`aliyun-sls-mcp-server` 是一个基于 TypeScript + Express 的 MCP 服务，用于让 AI Agent 通过 MCP 查询阿里云日志服务 SLS。

它适合这些场景：

- 线上故障排查
- 日常研发查日志
- 查询某些服务的 error/warn/info 日志
- 通过 traceId/TID 查询链路日志
- 查看某个服务在一段时间内的日志数量分布和报错趋势

底层数据源是阿里云 SLS，当前服务只做只读查询，不写入日志，不修改 SLS 配置。

## 效果展示

- 查询最近15分钟错误日志
<img width="3024" height="1740" alt="image" src="https://github.com/user-attachments/assets/c667fe0a-eaca-47d0-a133-59deb01b7c2d" />

- 查询某个服务的错误日志
<img width="3024" height="1740" alt="image" src="https://github.com/user-attachments/assets/e8a94492-7706-4979-a835-e8af01b1d48c" />
<img width="2056" height="964" alt="image" src="https://github.com/user-attachments/assets/0fd64a9b-9f05-44ef-bb79-933d878b7e7f" />

- 通过链路id查询错误日志，并分析问题
<img width="3024" height="1740" alt="image" src="https://github.com/user-attachments/assets/8c1d9024-be5e-4430-bdde-214dbd5e9f6c" />
<img width="3024" height="1740" alt="image" src="https://github.com/user-attachments/assets/35e6a215-d7fe-4f3e-b7b6-6be10f06b398" />

- 查看某个服务在一段时间内的日志数量分布和报错趋势
<img width="1788" height="1272" alt="image" src="https://github.com/user-attachments/assets/61270e82-42c5-47be-8730-b2977ce6e041" />


## 功能特性

- 查询当前账号可访问的 SLS Project
- 查询某个 Project 下的 Logstore
- 查询日志明细，底层使用 `GetLogsV2`
- 查询日志数量分布，底层使用 `GetHistograms`
- 支持按环境映射 Project + Logstore，例如 `test`、`staging`、`prod`
- 支持按服务名/容器名查询，字段默认使用 `_container_name_`
- 支持 `info`、`warn`、`error` 日志级别
- 支持 traceId/TID 查询，默认可查最近 7 天，可配置
- 支持分页，返回 `nextPage` 方便 Agent 继续翻页
- 支持限制返回字段，减少模型上下文占用
- 提供 Streamable HTTP MCP 服务
- 提供 HTTP 调试接口，方便用浏览器、Postman 或 curl 验证

## 不适合做什么

当前项目定位是“查日志”和“辅助排障”，不建议用它做 SLS 管理操作。

当前不支持，也不计划默认开放这些高风险能力：

- 写入日志
- 创建或删除 Project/Logstore
- 创建、修改或删除索引
- 修改告警、仪表盘、投递任务
- 管理机器组、Logtail 配置
- 执行无限制的大范围 SQL 分析

## 官方文档

本项目基于阿里云 SLS OpenAPI 构建，建议先阅读官方文档了解 SLS 的查询语法、权限和接口限制。

- [阿里云日志服务 SLS 文档](https://help.aliyun.com/zh/sls/)
- [SLS OpenAPI 概览](https://help.aliyun.com/zh/sls/developer-reference/api-sls-2020-12-30-overview)
- [GetLogsV2 查询日志](https://help.aliyun.com/zh/sls/developer-reference/api-sls-2020-12-30-getlogsv2)
- [GetHistograms 查询日志分布](https://help.aliyun.com/zh/sls/developer-reference/api-sls-2020-12-30-gethistograms)

如果具体 API 链接发生变化，以 SLS OpenAPI 概览和阿里云控制台文档入口为准。

## 获取阿里云访问凭证

本服务通过阿里云 OpenAPI 访问 SLS，需要配置 AccessKey。

建议创建一个专用 RAM 用户，并只授予 SLS 只读查询权限。不要使用阿里云主账号 AccessKey。

参考文档：

- [创建 AccessKey](https://help.aliyun.com/zh/ram/user-guide/create-an-accesskey-pair)
- [RAM 用户概览](https://help.aliyun.com/zh/ram/user-guide/users)
- [为 RAM 用户授权](https://help.aliyun.com/zh/ram/user-guide/grant-permissions-to-the-ram-user)

当前服务至少需要这些 SLS 查询能力：

- 查询 Project
- 查询 Logstore
- 查询日志明细，`GetLogsV2`
- 查询日志分布，`GetHistograms`

RAM 权限策略里的 Action 名称建议以阿里云官方权限文档和控制台生成为准。生产环境请使用最小权限，不要授予写入、删除、索引修改、告警修改等权限。

## 快速开始

```bash
git clone https://github.com/LilMosey/aliyun-sls-mcp-server.git
cd aliyun-sls-mcp-server
npm install
cp .env.example .env.local
```

编辑 `.env.local`，填入你的阿里云配置：

```bash
PORT=3000
SERVICE_NAME=aliyun-sls-mcp-server

ALIYUN_LOG_ACCESS_KEY_ID="你的AccessKeyId"
ALIYUN_LOG_ACCESS_KEY_SECRET="你的AccessKeySecret"
ALIYUN_LOG_REGION=cn-hangzhou

ALIYUN_LOG_DEFAULT_ENVIRONMENT=test
ALIYUN_LOG_ENVIRONMENTS={"test":{"projectName":"k8s-dev","logstoreName":"test"},"staging":{"projectName":"k8s-dev","logstoreName":"staging"}}
```

启动开发服务：

```bash
npm run dev
```

健康检查：

```bash
curl http://localhost:3000/health
```

预期返回：

```json
{
  "status": "ok",
  "service": "aliyun-sls-mcp-server"
}
```

## 环境变量

`.env.example` 是提交到 Git 的模板，不应该放真实密钥。`.env.local` 用于保存本机真实配置，已经被 `.gitignore` 忽略。

| 变量 | 必填 | 默认值 | 说明 |
|---|---:|---|---|
| `PORT` | 否 | `3000` | HTTP 服务端口 |
| `SERVICE_NAME` | 否 | `aliyun-sls-mcp-server` | 健康检查返回的服务名 |
| `ALIYUN_LOG_ACCESS_KEY_ID` | 是 | 无 | 阿里云 AccessKey ID |
| `ALIYUN_LOG_ACCESS_KEY_SECRET` | 是 | 无 | 阿里云 AccessKey Secret |
| `ALIYUN_LOG_REGION` | 是 | 无 | SLS 区域，例如 `cn-hangzhou` |
| `ALIYUN_LOG_ENDPOINT` | 否 | `${ALIYUN_LOG_REGION}.log.aliyuncs.com` | 自定义 SLS endpoint |
| `ALIYUN_LOG_ENVIRONMENTS` | 否 | 内置 `test` 示例 | 环境到 Project/Logstore 的映射 |
| `ALIYUN_LOG_DEFAULT_ENVIRONMENT` | 否 | `test` | 默认查询环境 |
| `ALIYUN_LOG_DEFAULT_QUERY_MINUTES` | 否 | `15` | 普通查询默认时间窗口 |
| `ALIYUN_LOG_MAX_QUERY_MINUTES` | 否 | `30` | 普通非空查询最大时间窗口 |
| `ALIYUN_LOG_EMPTY_QUERY_MAX_MINUTES` | 否 | `5` | 空查询最大时间窗口 |
| `ALIYUN_LOG_TRACE_DEFAULT_QUERY_MINUTES` | 否 | `10080` | traceId/TID 默认查询窗口，默认 7 天 |
| `ALIYUN_LOG_TRACE_MAX_QUERY_MINUTES` | 否 | `10080` | traceId/TID 最大查询窗口 |
| `ALIYUN_LOG_TRACE_MIN_LENGTH` | 否 | `16` | traceId/TID 最小长度 |
| `ALIYUN_LOG_DEFAULT_PAGE_SIZE` | 否 | `50` | 日志明细默认每页条数 |
| `ALIYUN_LOG_MAX_PAGE_SIZE` | 否 | `100` | 日志明细最大每页条数 |
| `ALIYUN_LOG_RETURN_FIELDS` | 否 | 返回全部字段 | 限制每条日志返回的原始字段 |

`ALIYUN_LOG_ENVIRONMENTS` 示例：

```bash
ALIYUN_LOG_ENVIRONMENTS={"test":{"projectName":"k8s-dev","logstoreName":"test"},"staging":{"projectName":"k8s-dev","logstoreName":"staging"}}
```

`ALIYUN_LOG_RETURN_FIELDS` 示例：

```bash
ALIYUN_LOG_RETURN_FIELDS=time,level,_container_name_,_pod_name_,_namespace_,content
```

字段名要和阿里云返回的原始字段保持一致。例如服务名字段通常是 `_container_name_`，不是 `containerName`。

## MCP 服务

当前提供 Streamable HTTP MCP 服务：

```text
POST /mcp
GET /mcp
DELETE /mcp
```

MCP 使用 stateful Streamable HTTP：

- 初始化请求会返回 `mcp-session-id`
- 后续 `POST /mcp` 需要带同一个 `mcp-session-id`
- `GET /mcp` 使用同一个 `mcp-session-id` 建立 SSE 长连接，用于接收服务端通知
- `DELETE /mcp` 使用同一个 `mcp-session-id` 终止会话

MCP 客户端配置示例：

```json
{
  "mcpServers": {
    "aliyun-sls-mcp-server": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

如果你的 MCP 客户端使用更简单的 server 列表格式，可以按下面这种结构改写：

```json
{
  "name": "aliyun-sls-mcp-server",
  "type": "streamable-http",
  "url": "http://localhost:3000/mcp"
}
```

不同 MCP 客户端的配置字段可能不同，例如有的客户端使用 `streamable-http`，有的客户端使用 `http` 或 `streamableHttp`。请以对应客户端文档为准，核心连接地址是：

```text
http://localhost:3000/mcp
```

## MCP 工具

| 工具名 | 作用 |
|---|---|
| `aliyun_log_list_projects` | 查询当前账号在指定区域下可访问的 SLS Project |
| `aliyun_log_list_logstores` | 查询某个 Project 下的 Logstore |
| `aliyun_log_query_logs` | 查询日志明细、服务日志、报错日志、traceId/TID 链路日志 |
| `aliyun_log_get_histograms` | 查询日志数量分布、错误趋势、故障开始时间线索 |

### `aliyun_log_query_logs`

常用参数：

```json
{
  "environment": "staging",
  "containerNames": ["user-service"],
  "level": "error",
  "minutes": 30,
  "pageNumber": 1,
  "pageSize": 50
}
```

说明：

- `environment` 不传时使用 `ALIYUN_LOG_DEFAULT_ENVIRONMENT`
- `containerNames` 是任意服务名/容器名，服务端会拼成 `_container_name_` 查询
- `level` 只支持 `info`、`warn`、`error`
- `traceId` 会拼成 `content: "traceId"`
- 用户说“最近 N 分钟/小时”时，适合传 `minutes`
- 用户说“今天 14:00 到 15:00”这种明确时间段时，Agent 应按 `Asia/Shanghai` 换算成 Unix 秒级 `from` 和 `to`
- `from/to` 和 `minutes` 不能同时传
- 返回 `nextPage` 时，下一次翻页应直接复用 `nextPage` 里的参数，避免重新计算时间窗口

### `aliyun_log_get_histograms`

常用参数：

```json
{
  "environment": "staging",
  "containerNames": ["user-service"],
  "level": "error",
  "minutes": 120
}
```

这个工具只返回每个时间段的日志数量，不返回日志明细。适合先判断是否有错误突增，再用 `aliyun_log_query_logs` 查询具体日志。

## Prompt 示例

查询最近 30 分钟某个服务的错误日志：

```text
帮我查询 staging 环境 user-service 最近 30 分钟的 error 日志
```

查看错误趋势：

```text
帮我看 staging 环境 user-service 最近 2 小时 error 日志分布，判断有没有突增
```

查询固定时间段日志：

```text
帮我查 staging 环境 user-service 今天 14:00 到 15:00 的错误日志
```

查询 traceId/TID 链路：

```text
帮我查询这个 traceId 最近 7 天的链路日志：b03a2133ebe048ccae56cb40125bb53d.574.17827209165150053
```

先看趋势，再查峰值时间段：

```text
帮我看 staging 环境 user-service 最近 2 小时 error 日志分布，如果有明显峰值，再查询峰值时间段的错误日志明细
```

## HTTP 调试接口

HTTP 接口主要用于本地调试和验证阿里云配置是否正确。

查询 Project：

```bash
curl "http://localhost:3000/aliyun-log/projects"
```

查询 Logstore：

```bash
curl "http://localhost:3000/aliyun-log/projects/k8s-dev/logstores"
```

按环境查询日志：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=staging" \
  --data-urlencode "containerNames=user-service" \
  --data-urlencode "level=error" \
  --data-urlencode "minutes=30"
```

查询 traceId/TID：

```bash
curl --get "http://localhost:3000/aliyun-log/logs" \
  --data-urlencode "environment=staging" \
  --data-urlencode "traceId=b03a2133ebe048ccae56cb40125bb53d.574.17827209165150053"
```

查询日志分布：

```bash
curl --get "http://localhost:3000/aliyun-log/histograms" \
  --data-urlencode "environment=staging" \
  --data-urlencode "containerNames=user-service" \
  --data-urlencode "level=error" \
  --data-urlencode "minutes=120"
```

直接指定 Project + Logstore：

```bash
curl --get "http://localhost:3000/aliyun-log/projects/k8s-dev/logstores/staging/logs" \
  --data-urlencode "query=level: error" \
  --data-urlencode "from=1719390000" \
  --data-urlencode "to=1719390900"
```

## 安全建议

- 不要提交 `.env.local`
- 不要使用阿里云主账号 AccessKey
- 建议为本服务创建专用 RAM 用户
- 建议只授予 SLS 只读查询权限
- 生产环境建议部署在内网或受控网络中
- 生产环境建议在反向代理层增加鉴权
- 日志可能包含手机号、邮箱、用户 ID、请求参数、业务数据等敏感信息，请谨慎暴露给外部 Agent
- 如果需要控制返回字段，请配置 `ALIYUN_LOG_RETURN_FIELDS`，减少敏感字段和上下文占用

## 开发命令

```bash
npm run dev
npm run typecheck
npm run build
npm start
```

说明：

- `npm run dev`：开发模式启动，使用 `tsx watch`
- `npm run typecheck`：只做 TypeScript 类型检查，不输出文件
- `npm run build`：编译到 `dist`
- `npm start`：运行编译后的 `dist/src/server.js`

## 项目结构

```text
src/
  server.ts                         # 进程入口，监听端口
  app.ts                            # Express 应用组装
  config/env.ts                     # 基础环境变量读取
  routes/
    health.ts                       # 健康检查
    mcp.ts                          # Streamable HTTP MCP 路由
  mcp-server.ts                     # MCP Server 和工具注册
  mcp-tools/
    aliyun-log-tool-definitions.ts  # MCP 工具名、描述、入参 schema
  mcp-services/
    aliyun-log/
      client.ts                     # 阿里云 SLS SDK client
      config.ts                     # SLS 配置读取
      projects.ts                   # ListProject
      logstores.ts                  # ListLogStores
      logs.ts                       # GetLogsV2
      histograms.ts                 # GetHistograms
      routes.ts                     # HTTP 调试接口
```

## Roadmap

- Docker 镜像和部署示例
- RAM 最小权限 Policy 示例
- 更多 MCP 客户端接入示例
- 可选鉴权中间件
- 更完整的日志脱敏配置
- 受控 SQL 聚合能力，例如按服务统计 error Top N

## License

MIT
