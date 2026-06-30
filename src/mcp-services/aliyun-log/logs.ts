import { GetLogsRequest } from "@alicloud/sls20201230/dist/models/GetLogsRequest.js";
import type { GetLogsResponse } from "@alicloud/sls20201230/dist/models/GetLogsResponse.js";

import { errorToLogFields, logger } from "../../utils/logger.js";
import { createAliyunLogClient } from "./client.js";
import {
  readAliyunLogEnvironmentConfig,
  readAliyunLogQueryConfig,
  readAliyunLogReturnFields
} from "./config.js";

export interface QueryLogsOptions {
  environment?: string;
  projectName?: string;
  logstoreName?: string;
  query?: string;
  containerNames?: string[];
  level?: "info" | "warn" | "error";
  traceId?: string;
  keywords?: string[];
  from?: number;
  to?: number;
  minutes?: number;
  pageNumber?: number;
  pageSize?: number;
  reverse?: boolean;
}

export interface QueryLogsNextPage {
  environment?: string;
  projectName?: string;
  logstoreName?: string;
  query: string;
  from: number;
  to: number;
  pageNumber: number;
  pageSize: number;
  reverse: boolean;
}

export interface QueryLogsResult {
  environment: string;
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
  nextPage?: QueryLogsNextPage;
  count: number;
  progress?: string;
  warnings: string[];
  logs: Record<string, unknown>[];
}

interface QueryConfig {
  defaultQueryMinutes: number;
  maxQueryMinutes: number;
  emptyQueryMaxMinutes: number;
  traceDefaultQueryMinutes: number;
  traceMaxQueryMinutes: number;
  traceMinLength: number;
  defaultPageSize: number;
  maxPageSize: number;
}

interface LogTarget {
  source: "environment" | "direct";
  environment: string;
  projectName: string;
  logstoreName: string;
}

function assertNonEmpty(value: string, name: string) {
  if (!value.trim()) {
    throw new Error(`${name} cannot be empty.`);
  }
}

function assertInteger(value: number, name: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
}

function assertPositiveInteger(value: number, name: string) {
  assertInteger(value, name);
  if (value <= 0) {
    throw new Error(`${name} must be greater than 0.`);
  }
}

function normalizeStringArray(values: string[] | undefined, name: string) {
  if (!values) {
    return [];
  }

  const normalizedValues = values.map((value) => value.trim()).filter(Boolean);
  if (normalizedValues.length === 0) {
    throw new Error(`${name} cannot be empty.`);
  }

  return normalizedValues;
}

function quoteContentValue(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function buildContainerNameQuery(containerNames: string[]) {
  if (containerNames.length === 0) {
    return undefined;
  }

  const parts = containerNames.map(
    (containerName) => `_container_name_: ${containerName}`
  );

  return parts.length === 1 ? parts[0] : `(${parts.join(" or ")})`;
}

function buildEffectiveQuery(options: QueryLogsOptions) {
  const parts: string[] = [];
  const query = options.query?.trim();
  const containerNames = normalizeStringArray(
    options.containerNames,
    "containerNames"
  );
  const keywords = normalizeStringArray(options.keywords, "keywords");
  const containerNameQuery = buildContainerNameQuery(containerNames);
  const traceId = options.traceId?.trim();

  if (query) {
    parts.push(`(${query})`);
  }

  if (containerNameQuery) {
    parts.push(containerNameQuery);
  }

  if (options.level) {
    parts.push(`level: ${options.level}`);
  }

  if (traceId) {
    parts.push(`content: ${quoteContentValue(traceId)}`);
  }

  for (const keyword of keywords) {
    parts.push(`content: ${quoteContentValue(keyword)}`);
  }

  return parts.join(" and ");
}

function resolveTraceId(options: QueryLogsOptions, config: QueryConfig) {
  const traceId = options.traceId?.trim();
  if (!traceId) {
    return undefined;
  }

  if (traceId.length < config.traceMinLength) {
    throw new Error(
      `traceId must be at least ${config.traceMinLength} characters.`
    );
  }

  return traceId;
}

function resolveTimeRange(options: QueryLogsOptions, config: QueryConfig) {
  const hasFrom = options.from !== undefined;
  const hasTo = options.to !== undefined;
  const hasMinutes = options.minutes !== undefined;

  if ((hasFrom || hasTo) && hasMinutes) {
    throw new Error("from/to and minutes cannot be used at the same time.");
  }

  let from: number;
  let to: number;
  const traceId = resolveTraceId(options, config);

  if (hasFrom || hasTo) {
    if (!hasFrom || !hasTo) {
      throw new Error("from and to must be provided together.");
    }

    from = options.from as number;
    to = options.to as number;
    assertInteger(from, "from");
    assertInteger(to, "to");
  } else {
    const query = buildEffectiveQuery(options);
    const defaultMinutes = traceId
      ? config.traceDefaultQueryMinutes
      : query
        ? config.defaultQueryMinutes
        : Math.min(config.defaultQueryMinutes, config.emptyQueryMaxMinutes);
    const minutes = options.minutes ?? defaultMinutes;
    assertPositiveInteger(minutes, "minutes");

    to = Math.floor(Date.now() / 1000);
    from = to - minutes * 60;
  }

  if (from >= to) {
    throw new Error("from must be less than to.");
  }

  const rangeMinutes = Math.ceil((to - from) / 60);
  const query = buildEffectiveQuery(options);
  const maxMinutes = traceId
    ? config.traceMaxQueryMinutes
    : query
      ? config.maxQueryMinutes
      : config.emptyQueryMaxMinutes;

  if (rangeMinutes > maxMinutes) {
    throw new Error(
      `Query time range cannot exceed ${maxMinutes} minutes for ${
        traceId ? "traceId" : query ? "non-empty" : "empty"
      } query.`
    );
  }

  return { from, to };
}

function resolveLogTarget(options: QueryLogsOptions): LogTarget {
  const hasProjectName = options.projectName !== undefined;
  const hasLogstoreName = options.logstoreName !== undefined;

  if (hasProjectName || hasLogstoreName) {
    if (options.environment) {
      throw new Error(
        "environment cannot be used together with projectName/logstoreName."
      );
    }

    if (!options.projectName || !options.logstoreName) {
      throw new Error(
        "projectName and logstoreName must be provided together."
      );
    }

    assertNonEmpty(options.projectName, "projectName");
    assertNonEmpty(options.logstoreName, "logstoreName");

    return {
      source: "direct",
      environment: "custom",
      projectName: options.projectName,
      logstoreName: options.logstoreName
    };
  }

  const { defaultEnvironment, environments } = readAliyunLogEnvironmentConfig();
  const environment = options.environment ?? defaultEnvironment;
  const target = environments[environment];

  if (!target) {
    throw new Error(
      `Unknown aliyun log environment: ${environment}. Allowed environments: ${Object.keys(
        environments
      ).join(", ")}.`
    );
  }

  return {
    source: "environment",
    environment,
    projectName: target.projectName,
    logstoreName: target.logstoreName
  };
}

function resolvePage(options: QueryLogsOptions, config: QueryConfig) {
  const pageNumber = options.pageNumber ?? 1;
  const pageSize = options.pageSize ?? config.defaultPageSize;

  assertPositiveInteger(pageNumber, "pageNumber");
  assertPositiveInteger(pageSize, "pageSize");

  if (config.defaultPageSize > config.maxPageSize) {
    throw new Error(
      "ALIYUN_LOG_DEFAULT_PAGE_SIZE cannot be greater than ALIYUN_LOG_MAX_PAGE_SIZE."
    );
  }

  if (pageSize > config.maxPageSize) {
    throw new Error(
      `pageSize cannot be greater than configured max page size ${config.maxPageSize}.`
    );
  }

  return {
    pageNumber,
    pageSize,
    offset: (pageNumber - 1) * pageSize
  };
}

function filterLogFields(
  log: Record<string, unknown>,
  returnFields: string[] | undefined
) {
  if (!returnFields) {
    return log;
  }

  const filteredLog: Record<string, unknown> = {};
  for (const field of returnFields) {
    if (log[field] !== undefined) {
      filteredLog[field] = log[field];
    }
  }

  return filteredLog;
}

function buildWarnings(query: string) {
  const warnings: string[] = [];

  if (query.includes("|")) {
    warnings.push(
      "当前 query 看起来包含分析语句；阿里云 GetLogs 对分析语句可能会忽略 line/offset，分页建议在 SQL 中使用 limit/offset。"
    );
  }

  return warnings;
}

function buildNextPage(
  target: LogTarget,
  query: string,
  from: number,
  to: number,
  pageNumber: number,
  pageSize: number,
  reverse: boolean,
  hasMore: boolean
): QueryLogsNextPage | undefined {
  if (!hasMore) {
    return undefined;
  }

  const common = {
    query,
    from,
    to,
    pageNumber: pageNumber + 1,
    pageSize,
    reverse
  };

  if (target.source === "environment") {
    return {
      environment: target.environment,
      ...common
    };
  }

  return {
    projectName: target.projectName,
    logstoreName: target.logstoreName,
    ...common
  };
}

export async function queryLogs(
  options: QueryLogsOptions
): Promise<QueryLogsResult> {
  const target = resolveLogTarget(options);
  const config = readAliyunLogQueryConfig();
  const returnFields = readAliyunLogReturnFields();
  const query = buildEffectiveQuery(options);
  const { from, to } = resolveTimeRange(options, config);
  const { pageNumber, pageSize, offset } = resolvePage(options, config);
  const reverse = options.reverse ?? true;
  const startedAt = Date.now();

  const client = createAliyunLogClient();
  logger.info("Calling Aliyun Log GetLogs.", {
    operation: "aliyun-log.getLogs",
    environment: target.environment,
    projectName: target.projectName,
    logstoreName: target.logstoreName,
    from,
    to,
    query,
    reverse,
    pageNumber,
    pageSize,
    offset
  });

  let response: GetLogsResponse;
  try {
    response = await client.getLogs(
      target.projectName,
      target.logstoreName,
      new GetLogsRequest({
        from,
        to,
        query,
        line: pageSize,
        offset,
        reverse
      })
    );
  } catch (error) {
    logger.error("Aliyun Log GetLogs failed.", {
      operation: "aliyun-log.getLogs",
      durationMs: Date.now() - startedAt,
      environment: target.environment,
      projectName: target.projectName,
      logstoreName: target.logstoreName,
      from,
      to,
      query,
      reverse,
      pageNumber,
      pageSize,
      offset,
      ...errorToLogFields(error)
    });
    throw error;
  }

  const logs = (response.body ?? []).map((log) =>
    filterLogFields(log as Record<string, unknown>, returnFields)
  );
  const hasMore = logs.length === pageSize;
  const nextPage = buildNextPage(
    target,
    query,
    from,
    to,
    pageNumber,
    pageSize,
    reverse,
    hasMore
  );
  logger.info("Aliyun Log GetLogs succeeded.", {
    operation: "aliyun-log.getLogs",
    durationMs: Date.now() - startedAt,
    environment: target.environment,
    projectName: target.projectName,
    logstoreName: target.logstoreName,
    from,
    to,
    query,
    reverse,
    pageNumber,
    pageSize,
    offset,
    count: logs.length,
    hasMore,
    progress: response.headers?.["x-log-progress"]
  });

  return {
    environment: target.environment,
    projectName: target.projectName,
    logstoreName: target.logstoreName,
    from,
    to,
    query,
    reverse,
    page: {
      pageNumber,
      pageSize,
      offset,
      hasMore
    },
    nextPage,
    count: logs.length,
    progress: response.headers?.["x-log-progress"],
    warnings: buildWarnings(query),
    logs
  };
}
