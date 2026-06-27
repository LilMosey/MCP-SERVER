import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { listProjects } from "./mcp-services/aliyun-log/projects.js";

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "codemao-mcp-service",
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

  return server;
}
