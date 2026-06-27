import express from "express";

import { env } from "./config/env.js";
import { aliyunLogRouter } from "./mcp-services/aliyun-log/routes.js";
import { mcpRouter } from "./routes/mcp.js";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/", (_request, response) => {
    response.json({
      name: env.serviceName,
      status: "ok",
      services: {
        mysqlMetadata: "planned",
        aliyunLog: "planned"
      }
    });
  });

  app.use("/health", healthRouter);
  app.use("/aliyun-log", aliyunLogRouter);
  app.use("/mcp", mcpRouter);

  return app;
}
