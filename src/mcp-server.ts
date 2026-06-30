import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { listLogStores } from "./mcp-services/aliyun-log/logstores.js";
import { queryLogs } from "./mcp-services/aliyun-log/logs.js";
import { listProjects } from "./mcp-services/aliyun-log/projects.js";

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "mcp-service",
      version: "0.1.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  server.registerTool(
    "aliyun_log_list_projects",
    {
      title: "查询阿里云日志 Project",
      description:
        "查询当前阿里云日志服务账号在指定区域下可访问的 Project。projectName 不传时查询全部 Project。",
      inputSchema: {
        projectName: z
          .string()
          .optional()
          .describe("Project 名称，支持阿里云 ListProject 的模糊查询。"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("分页起始位置，默认 0。"),
        size: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("每页数量，默认 100，最大 500。")
      }
    },
    async ({ projectName, offset, size }, extra) => {
      await server.sendLoggingMessage(
        {
          level: "info",
          data: {
            message: "开始查询阿里云日志 Project",
            projectName: projectName ?? null
          }
        },
        extra.sessionId
      );

      const result = await listProjects({
        projectName,
        offset,
        size
      });

      await server.sendLoggingMessage(
        {
          level: "info",
          data: {
            message: "阿里云日志 Project 查询完成",
            count: result.count,
            total: result.total
          }
        },
        extra.sessionId
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  server.registerTool(
    "aliyun_log_list_logstores",
    {
      title: "查询阿里云日志库",
      description:
        "查询某个阿里云日志 Project 下的 Logstore 列表。projectName 必填，logstoreName 支持模糊查询。",
      inputSchema: {
        projectName: z.string().describe("Project 名称，例如 k8s-dev。"),
        logstoreName: z
          .string()
          .optional()
          .describe("Logstore 名称，支持阿里云 ListLogStores 的模糊查询。"),
        mode: z
          .enum(["standard", "query"])
          .optional()
          .describe("Logstore 类型：standard 或 query。"),
        telemetryType: z
          .enum(["None", "Metrics"])
          .optional()
          .describe("数据类型：None 表示日志，Metrics 表示指标。"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("分页起始位置，默认 0。"),
        size: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("每页数量，默认 200，最大 500。")
      }
    },
    async (
      { projectName, logstoreName, mode, telemetryType, offset, size },
      extra
    ) => {
      await server.sendLoggingMessage(
        {
          level: "info",
          data: {
            message: "开始查询阿里云日志库",
            projectName,
            logstoreName: logstoreName ?? null
          }
        },
        extra.sessionId
      );

      const result = await listLogStores({
        projectName,
        logstoreName,
        mode,
        telemetryType,
        offset,
        size
      });

      await server.sendLoggingMessage(
        {
          level: "info",
          data: {
            message: "阿里云日志库查询完成",
            projectName,
            count: result.count,
            total: result.total
          }
        },
        extra.sessionId
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  server.registerTool(
    "aliyun_log_query_logs",
    {
      title: "查询阿里云日志",
      description:
        "查询阿里云日志。优先传 environment，不传默认 test；也可以直接传 projectName + logstoreName 调试。可以直接传 query，也可以传 containerNames、level、traceId、keywords 让服务端自动用 and 拼接最终 query。常用查询字段：服务字段 _container_name_，日志级别字段 level，级别只有 info、warn、error，traceId 通常查 content。传 traceId 且不传 from/to/minutes 时默认查最近 7 天；普通非空查询默认最近 15 分钟。分页时如果返回 nextPage，下一次调用应直接使用 nextPage 参数，避免重新计算时间窗口。",
      inputSchema: {
        environment: z
          .string()
          .optional()
          .describe("环境名称，例如 test、staging。不传时使用默认环境 test。"),
        projectName: z
          .string()
          .optional()
          .describe("Project 名称，例如 k8s-dev。临时调试时可和 logstoreName 一起传。"),
        logstoreName: z
          .string()
          .optional()
          .describe("Logstore 名称，例如 test。临时调试时可和 projectName 一起传。"),
        query: z
          .string()
          .optional()
          .describe(
            "阿里云日志查询语句。可以和结构化参数混用，最终会用 and 拼接，例如 query + level + containerNames。"
          ),
        containerNames: z
          .array(z.string())
          .optional()
          .describe("服务名列表/项目名列表，会拼成 _container_name_ 查询；多个服务用 or 包在括号里。"),
        level: z
          .enum(["info", "warn", "error"])
          .optional()
          .describe("日志级别，只支持 info、warn、error。"),
        traceId: z
          .string()
          .optional()
          .describe("traceId，会拼成 content: \"traceId\"。不传时间范围时，traceId 查询默认最近 7 天。"),
        keywords: z
          .array(z.string())
          .optional()
          .describe("内容关键字列表，每个关键字会拼成 content: \"keyword\"，多个关键字用 and 连接。"),
        from: z
          .number()
          .int()
          .optional()
          .describe("查询开始时间，Unix 秒级时间戳，需要和 to 同时传。"),
        to: z
          .number()
          .int()
          .optional()
          .describe("查询结束时间，Unix 秒级时间戳，需要和 from 同时传。"),
        minutes: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("查询最近多少分钟；不能和 from/to 同时传。"),
        pageNumber: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("页码，从 1 开始，默认 1。翻页时优先使用上次返回的 nextPage.pageNumber。"),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页日志条数，默认 50，最大 100。"),
        reverse: z
          .boolean()
          .optional()
          .describe("是否按时间倒序返回，默认 true。")
      }
    },
    async (
      {
        environment,
        projectName,
        logstoreName,
        query,
        containerNames,
        level,
        traceId,
        keywords,
        from,
        to,
        minutes,
        pageNumber,
        pageSize,
        reverse
      },
      extra
    ) => {
      await server.sendLoggingMessage(
        {
          level: "info",
          data: {
            message: "开始查询阿里云日志",
            environment: environment ?? null,
            projectName: projectName ?? null,
            logstoreName: logstoreName ?? null,
            query: query ?? null,
            containerNames: containerNames ?? null,
            level: level ?? null,
            traceId: traceId ?? null,
            keywords: keywords ?? null,
            pageNumber: pageNumber ?? 1
          }
        },
        extra.sessionId
      );

      const result = await queryLogs({
        environment,
        projectName,
        logstoreName,
        query,
        containerNames,
        level,
        traceId,
        keywords,
        from,
        to,
        minutes,
        pageNumber,
        pageSize,
        reverse
      });

      await server.sendLoggingMessage(
        {
          level: "info",
          data: {
            message: "阿里云日志查询完成",
            environment: result.environment,
            projectName: result.projectName,
            logstoreName: result.logstoreName,
            count: result.count,
            hasMore: result.page.hasMore,
            progress: result.progress ?? null
          }
        },
        extra.sessionId
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  return server;
}
