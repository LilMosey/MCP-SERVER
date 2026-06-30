function readRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function buildDefaultEndpoint(region: string) {
  return `${region}.log.aliyuncs.com`;
}

function assertNonEmptyString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value;
}

function readPositiveIntegerEnv(name: string, defaultValue: number) {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return numberValue;
}

function readAliyunLogEnvironmentMap() {
  const defaultMap: Record<
    string,
    {
      projectName: string;
      logstoreName: string;
    }
  > = {
    test: {
      projectName: "k8s-dev",
      logstoreName: "test"
    }
  };
  const value = process.env.ALIYUN_LOG_ENVIRONMENTS;
  if (!value) {
    return defaultMap;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("ALIYUN_LOG_ENVIRONMENTS must be a valid JSON object.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ALIYUN_LOG_ENVIRONMENTS must be a JSON object.");
  }

  const environments: Record<
    string,
    {
      projectName: string;
      logstoreName: string;
    }
  > = {};

  for (const [environment, target] of Object.entries(parsed)) {
    assertNonEmptyString(environment, "environment name");

    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error(
        `ALIYUN_LOG_ENVIRONMENTS.${environment} must be an object.`
      );
    }

    const targetRecord = target as Record<string, unknown>;
    environments[environment] = {
      projectName: assertNonEmptyString(
        targetRecord.projectName,
        `ALIYUN_LOG_ENVIRONMENTS.${environment}.projectName`
      ),
      logstoreName: assertNonEmptyString(
        targetRecord.logstoreName,
        `ALIYUN_LOG_ENVIRONMENTS.${environment}.logstoreName`
      )
    };
  }

  if (Object.keys(environments).length === 0) {
    throw new Error("ALIYUN_LOG_ENVIRONMENTS must define at least one environment.");
  }

  return environments;
}

export function readAliyunLogReturnFields() {
  const value = process.env.ALIYUN_LOG_RETURN_FIELDS;
  if (!value) {
    return undefined;
  }

  const fields = value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  if (fields.length === 0) {
    return undefined;
  }

  return fields;
}

export function readAliyunLogConfig() {
  const region = readRequiredEnv("ALIYUN_LOG_REGION");

  return {
    accessKeyId: readRequiredEnv("ALIYUN_LOG_ACCESS_KEY_ID"),
    accessKeySecret: readRequiredEnv("ALIYUN_LOG_ACCESS_KEY_SECRET"),
    region,
    endpoint: process.env.ALIYUN_LOG_ENDPOINT ?? buildDefaultEndpoint(region)
  };
}

export function readAliyunLogQueryConfig() {
  const maxPageSize = readPositiveIntegerEnv("ALIYUN_LOG_MAX_PAGE_SIZE", 100);

  if (maxPageSize > 100) {
    throw new Error("ALIYUN_LOG_MAX_PAGE_SIZE cannot be greater than 100.");
  }

  return {
    defaultQueryMinutes: readPositiveIntegerEnv(
      "ALIYUN_LOG_DEFAULT_QUERY_MINUTES",
      15
    ),
    maxQueryMinutes: readPositiveIntegerEnv("ALIYUN_LOG_MAX_QUERY_MINUTES", 30),
    emptyQueryMaxMinutes: readPositiveIntegerEnv(
      "ALIYUN_LOG_EMPTY_QUERY_MAX_MINUTES",
      5
    ),
    traceDefaultQueryMinutes: readPositiveIntegerEnv(
      "ALIYUN_LOG_TRACE_DEFAULT_QUERY_MINUTES",
      10080
    ),
    traceMaxQueryMinutes: readPositiveIntegerEnv(
      "ALIYUN_LOG_TRACE_MAX_QUERY_MINUTES",
      10080
    ),
    traceMinLength: readPositiveIntegerEnv("ALIYUN_LOG_TRACE_MIN_LENGTH", 16),
    defaultPageSize: readPositiveIntegerEnv(
      "ALIYUN_LOG_DEFAULT_PAGE_SIZE",
      50
    ),
    maxPageSize
  };
}

export function readAliyunLogEnvironmentConfig() {
  const environments = readAliyunLogEnvironmentMap();
  const defaultEnvironment =
    process.env.ALIYUN_LOG_DEFAULT_ENVIRONMENT ?? "test";

  if (!environments[defaultEnvironment]) {
    throw new Error(
      `ALIYUN_LOG_DEFAULT_ENVIRONMENT ${defaultEnvironment} is not defined in ALIYUN_LOG_ENVIRONMENTS.`
    );
  }

  return {
    defaultEnvironment,
    environments
  };
}
