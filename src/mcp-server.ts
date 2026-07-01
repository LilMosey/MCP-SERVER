import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { queryHistograms } from "./mcp-services/aliyun-log/histograms.js";
import { listLogStores } from "./mcp-services/aliyun-log/logstores.js";
import { queryLogs } from "./mcp-services/aliyun-log/logs.js";
import { listProjects } from "./mcp-services/aliyun-log/projects.js";
import {
  aliyunLogToolNames,
  createGetHistogramsToolConfig,
  createQueryLogsToolConfig,
  listLogstoresToolConfig,
  listProjectsToolConfig
} from "./mcp-tools/aliyun-log-tool-definitions.js";

export function registerAliyunLogTools(server: McpServer) {
  return {
    listProjects: server.registerTool(
      aliyunLogToolNames.listProjects,
      listProjectsToolConfig,
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
    ),

    listLogstores: server.registerTool(
      aliyunLogToolNames.listLogstores,
      listLogstoresToolConfig,
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
    ),

    queryLogs: server.registerTool(
      aliyunLogToolNames.queryLogs,
      createQueryLogsToolConfig(),
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
    ),

    getHistograms: server.registerTool(
      aliyunLogToolNames.getHistograms,
      createGetHistogramsToolConfig(),
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
          minutes
        },
        extra
      ) => {
        await server.sendLoggingMessage(
          {
            level: "info",
            data: {
              message: "开始查询阿里云日志分布",
              environment: environment ?? null,
              projectName: projectName ?? null,
              logstoreName: logstoreName ?? null,
              query: query ?? null,
              containerNames: containerNames ?? null,
              level: level ?? null,
              traceId: traceId ?? null,
              keywords: keywords ?? null
            }
          },
          extra.sessionId
        );

        const result = await queryHistograms({
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
          minutes
        });

        await server.sendLoggingMessage(
          {
            level: "info",
            data: {
              message: "阿里云日志分布查询完成",
              environment: result.environment,
              projectName: result.projectName,
              logstoreName: result.logstoreName,
              total: result.total,
              count: result.histograms.length,
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
    )
  };
}

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "aliyun-sls-mcp-server",
      version: "0.1.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  registerAliyunLogTools(server);

  return server;
}
