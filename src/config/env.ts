import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

function readPort(value: string | undefined) {
  if (!value) {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

export const env = {
  port: readPort(process.env.PORT),
  serviceName: process.env.SERVICE_NAME ?? "mcp-server"
};
