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

export function readAliyunLogConfig() {
  const region = readRequiredEnv("ALIYUN_LOG_REGION");

  return {
    accessKeyId: readRequiredEnv("ALIYUN_LOG_ACCESS_KEY_ID"),
    accessKeySecret: readRequiredEnv("ALIYUN_LOG_ACCESS_KEY_SECRET"),
    region,
    endpoint: process.env.ALIYUN_LOG_ENDPOINT ?? buildDefaultEndpoint(region)
  };
}
