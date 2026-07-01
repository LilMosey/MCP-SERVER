import { z } from "zod/v4";

import { readAliyunLogEnvironmentConfig } from "../mcp-services/aliyun-log/config.js";

export const aliyunLogToolNames = {
  listProjects: "aliyun_log_list_projects",
  listLogstores: "aliyun_log_list_logstores",
  queryLogs: "aliyun_log_query_logs",
  getHistograms: "aliyun_log_get_histograms"
} as const;

function buildConfiguredEnvironmentHint() {
  try {
    const { defaultEnvironment, environments } = readAliyunLogEnvironmentConfig();
    const environmentNames = Object.keys(environments).sort();
    const environmentList = environmentNames.join("、");
    const hints: string[] = [];
    const testEnvironment = ["test", "testing", "dev", "development"].find(
      (environment) => environmentNames.includes(environment)
    );
    const stagingEnvironment = ["staging", "stage", "pre", "uat"].find(
      (environment) => environmentNames.includes(environment)
    );
    const productionEnvironment = [
      "prod",
      "production",
      "prd",
      "online"
    ].find((environment) => environmentNames.includes(environment));

    if (testEnvironment) {
      hints.push(`用户说“测试环境”时优先传 ${testEnvironment}`);
    }

    if (stagingEnvironment) {
      hints.push(`用户说“预发/staging 环境”时优先传 ${stagingEnvironment}`);
    }

    if (productionEnvironment) {
      hints.push(
        `用户说“生产环境/线上环境”时优先传 ${productionEnvironment}`
      );
    }

    return `当前配置可用环境：${environmentList}。默认环境：${defaultEnvironment}。environment 必须优先从这些值中选择。${hints.join("；")}。`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return `当前环境配置读取失败：${message}。可以直接传 projectName + logstoreName 调试。`;
  }
}

function appendEnvironmentHint(description: string) {
  return `${description} ${buildConfiguredEnvironmentHint()}`;
}

export const listProjectsToolConfig = {
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
};

export const listLogstoresToolConfig = {
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
};

export const queryLogsToolConfig = {
  title: "查询日志",
  description:
    "查询日志、SLS 日志、线上日志、服务日志；底层数据源是阿里云 SLS。用于线上故障排查、日常研发查日志、任意服务的报错日志查询、traceId/TID 链路日志查询。用户要求“查日志”“查询日志”“查 SLS”“查询 SLS”“查服务日志”“查线上日志”，或提到 test、staging 等环境，任意服务名/容器名的日志，最近 N 分钟/小时报错日志，某个明确时间段的日志，error/warn/info 日志，traceId/TID 查询时，应优先使用本工具。环境请传 environment，用户说到的服务名或容器名请原样放入 containerNames，日志级别请传 level，traceId/TID 请传 traceId。用户说“最近 N 分钟/小时”时传 minutes；用户说明确时间段，例如“今天 14:00 到 15:00”“昨天晚上 8 点到 9 点”“2026-06-30 10:00 到 10:30”时，按 Asia/Shanghai 理解并换算成 Unix 秒级时间戳后传 from 和 to。也支持直接传 query 使用 SLS 查询语法。优先传 environment，不传默认 test；也可以直接传 projectName + logstoreName 调试。服务端会把 query、containerNames、level、traceId、keywords 用 and 拼成最终查询条件。传 traceId 且不传 from/to/minutes 时默认查最近 7 天；普通非空查询默认最近 15 分钟。分页时如果返回 nextPage，下一次调用应直接使用 nextPage 参数，避免重新计算时间窗口。",
  inputSchema: {
    environment: z
      .string()
      .optional()
      .describe(
        "日志环境名称，例如 test、staging。不传时使用默认环境 test。用户说“测试环境”“staging 环境”等，一般映射到这个参数。"
      ),
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
        "阿里云 SLS 原生查询语句。用户已经给出完整查询条件时传这里，例如 (_container_name_:服务A or _container_name_:服务B) and level:error。可以和 containerNames、level、traceId、keywords 混用。"
      ),
    containerNames: z
      .array(z.string())
      .optional()
      .describe(
        "任意服务名/容器名列表。用户说“查某个服务的日志/报错日志”时，把用户原文中的服务名原样放到这里；多个服务会用 or 查询。"
      ),
    level: z
      .enum(["info", "warn", "error"])
      .optional()
      .describe(
        "日志级别，只支持 info、warn、error。用户说“报错日志”“错误日志”“error 日志”时，一般传 error。"
      ),
    traceId: z
      .string()
      .optional()
      .describe(
        "traceId 或 TID，用于查询整条链路日志，会拼成 content: \"traceId\"。不传时间范围时默认最近 7 天。"
      ),
    keywords: z
      .array(z.string())
      .optional()
      .describe("内容关键字列表，每个关键字会拼成 content: \"keyword\"，多个关键字用 and 连接。"),
    from: z
      .number()
      .int()
      .optional()
      .describe(
        "查询开始时间，Unix 秒级时间戳，需要和 to 同时传。用户说明确时间段时，按 Asia/Shanghai 换算后传这里。"
      ),
    to: z
      .number()
      .int()
      .optional()
      .describe(
        "查询结束时间，Unix 秒级时间戳，需要和 from 同时传。用户说明确时间段时，按 Asia/Shanghai 换算后传这里。"
      ),
    minutes: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("查询最近多少分钟；用户说“最近 N 分钟/小时”时传这里，小时需要换算成分钟；不能和 from/to 同时传。"),
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
    reverse: z.boolean().optional().describe("是否按时间倒序返回，默认 true。")
  }
};

export function createQueryLogsToolConfig() {
  return {
    ...queryLogsToolConfig,
    description: appendEnvironmentHint(queryLogsToolConfig.description)
  };
}

export const getHistogramsToolConfig = {
  title: "查询日志分布",
  description:
    "查询日志分布、SLS 日志分布、线上日志趋势、服务日志趋势；底层数据源是阿里云 SLS。用于判断任意服务的报错是否突增、故障大概从什么时候开始、某个服务最近一段时间或某个明确时间段内是否有 error/warn/info 日志。用户要求“看日志趋势”“查日志分布”“查 SLS 分布”“看报错趋势”“最近 N 分钟/小时每段时间多少错误”“某个时间段的错误分布”“故障从什么时候开始”时，应优先使用本工具。本工具只返回每个时间段的日志数量，不返回日志明细；如果需要具体日志内容，再使用 aliyun_log_query_logs。环境请传 environment，用户说到的服务名或容器名请原样放入 containerNames，日志级别请传 level，traceId/TID 请传 traceId。用户说“最近 N 分钟/小时”时传 minutes；用户说明确时间段，例如“今天 14:00 到 15:00”“昨天晚上 8 点到 9 点”“2026-06-30 10:00 到 10:30”时，按 Asia/Shanghai 理解并换算成 Unix 秒级时间戳后传 from 和 to。也支持直接传 query 使用 SLS 查询语法。",
  inputSchema: {
    environment: z
      .string()
      .optional()
      .describe(
        "日志环境名称，例如 test、staging。不传时使用默认环境 test。用户说“测试环境”“staging 环境”等，一般映射到这个参数。"
      ),
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
        "阿里云 SLS 原生查询语句。用户已经给出完整查询条件时传这里，例如 (_container_name_:服务A or _container_name_:服务B) and level:error。可以和 containerNames、level、traceId、keywords 混用。"
      ),
    containerNames: z
      .array(z.string())
      .optional()
      .describe(
        "任意服务名/容器名列表。用户说“查看某个服务的错误分布/日志趋势”时，把用户原文中的服务名原样放到这里；多个服务会用 or 查询。"
      ),
    level: z
      .enum(["info", "warn", "error"])
      .optional()
      .describe(
        "日志级别，只支持 info、warn、error。用户说“报错分布”“错误趋势”“error 趋势”时，一般传 error。"
      ),
    traceId: z
      .string()
      .optional()
      .describe(
        "traceId 或 TID，会拼成 content: \"traceId\"。不传时间范围时默认最近 7 天。"
      ),
    keywords: z
      .array(z.string())
      .optional()
      .describe("内容关键字列表，每个关键字会拼成 content: \"keyword\"，多个关键字用 and 连接。"),
    from: z
      .number()
      .int()
      .optional()
      .describe(
        "查询开始时间，Unix 秒级时间戳，需要和 to 同时传。用户说明确时间段时，按 Asia/Shanghai 换算后传这里。"
      ),
    to: z
      .number()
      .int()
      .optional()
      .describe(
        "查询结束时间，Unix 秒级时间戳，需要和 from 同时传。用户说明确时间段时，按 Asia/Shanghai 换算后传这里。"
      ),
    minutes: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("查询最近多少分钟；用户说“最近 N 分钟/小时”时传这里，小时需要换算成分钟；不能和 from/to 同时传。")
  }
};

export function createGetHistogramsToolConfig() {
  return {
    ...getHistogramsToolConfig,
    description: appendEnvironmentHint(getHistogramsToolConfig.description)
  };
}
