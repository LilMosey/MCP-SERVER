import { Router } from "express";

import { listLogStores } from "./logstores.js";
import { queryLogs } from "./logs.js";
import { listProjects } from "./projects.js";

export const aliyunLogRouter = Router();

function readStringQuery(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNumberQuery(value: unknown) {
  return typeof value === "string" ? Number(value) : undefined;
}

function readStringArrayQuery(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      typeof item === "string" ? item.split(",") : []
    );
  }

  return typeof value === "string" ? value.split(",") : undefined;
}

function readLevelQuery(value: unknown) {
  if (value !== "info" && value !== "warn" && value !== "error") {
    if (value === undefined) {
      return undefined;
    }

    throw new Error("level must be one of: info, warn, error.");
  }

  return value;
}

function readBooleanQuery(value: unknown) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

aliyunLogRouter.get("/projects", async (request, response, next) => {
  try {
    const projectName = readStringQuery(request.query.projectName);
    const offset = readNumberQuery(request.query.offset);
    const size = readNumberQuery(request.query.size);

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

aliyunLogRouter.get("/logs", async (request, response, next) => {
  try {
    const result = await queryLogs({
      environment: readStringQuery(request.query.environment),
      query: readStringQuery(request.query.query),
      containerNames: readStringArrayQuery(request.query.containerNames),
      level: readLevelQuery(request.query.level),
      traceId: readStringQuery(request.query.traceId),
      keywords: readStringArrayQuery(request.query.keywords),
      from: readNumberQuery(request.query.from),
      to: readNumberQuery(request.query.to),
      minutes: readNumberQuery(request.query.minutes),
      pageNumber: readNumberQuery(request.query.pageNumber),
      pageSize: readNumberQuery(request.query.pageSize),
      reverse: readBooleanQuery(request.query.reverse)
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
      const logstoreName = readStringQuery(request.query.logstoreName);
      const mode = readStringQuery(request.query.mode);
      const offset = readNumberQuery(request.query.offset);
      const size = readNumberQuery(request.query.size);
      const telemetryType = readStringQuery(request.query.telemetryType);

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

aliyunLogRouter.get(
  "/projects/:projectName/logstores/:logstoreName/logs",
  async (request, response, next) => {
    try {
      const result = await queryLogs({
        projectName: request.params.projectName,
        logstoreName: request.params.logstoreName,
        query: readStringQuery(request.query.query),
        containerNames: readStringArrayQuery(request.query.containerNames),
        level: readLevelQuery(request.query.level),
        traceId: readStringQuery(request.query.traceId),
        keywords: readStringArrayQuery(request.query.keywords),
        from: readNumberQuery(request.query.from),
        to: readNumberQuery(request.query.to),
        minutes: readNumberQuery(request.query.minutes),
        pageNumber: readNumberQuery(request.query.pageNumber),
        pageSize: readNumberQuery(request.query.pageSize),
        reverse: readBooleanQuery(request.query.reverse)
      });

      response.json(result);
    } catch (error) {
      next(error);
    }
  }
);
