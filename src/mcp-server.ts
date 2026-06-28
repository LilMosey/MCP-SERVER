import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { listLogStores } from "./mcp-services/aliyun-log/logstores.js";
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

  return server;
}
