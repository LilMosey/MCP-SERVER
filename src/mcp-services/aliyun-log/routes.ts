import { Router } from "express";

import { listLogStores } from "./logstores.js";
import { listProjects } from "./projects.js";

export const aliyunLogRouter = Router();

aliyunLogRouter.get("/projects", async (request, response, next) => {
  try {
    const projectName =
      typeof request.query.projectName === "string"
        ? request.query.projectName
        : undefined;
    const offset =
      typeof request.query.offset === "string"
        ? Number(request.query.offset)
        : undefined;
    const size =
      typeof request.query.size === "string"
        ? Number(request.query.size)
        : undefined;

    const result = await listProjects({
      projectName,
      offset,
      size
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

aliyunLogRouter.get(
  "/projects/:projectName/logstores",
  async (request, response, next) => {
    try {
      const logstoreName =
        typeof request.query.logstoreName === "string"
          ? request.query.logstoreName
          : undefined;
      const mode =
        typeof request.query.mode === "string" ? request.query.mode : undefined;
      const offset =
        typeof request.query.offset === "string"
          ? Number(request.query.offset)
          : undefined;
      const size =
        typeof request.query.size === "string"
          ? Number(request.query.size)
          : undefined;
      const telemetryType =
        typeof request.query.telemetryType === "string"
          ? request.query.telemetryType
          : undefined;

      const result = await listLogStores({
        projectName: request.params.projectName,
        logstoreName,
        mode,
        offset,
        size,
        telemetryType
      });

      response.json(result);
    } catch (error) {
      next(error);
    }
  }
);
