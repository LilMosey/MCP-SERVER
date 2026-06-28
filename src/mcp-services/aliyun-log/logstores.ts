import { ListLogStoresRequest } from "@alicloud/sls20201230/dist/models/ListLogStoresRequest.js";

import { createAliyunLogClient } from "./client.js";

export interface ListLogStoresOptions {
  projectName: string;
  logstoreName?: string;
  mode?: string;
  offset?: number;
  size?: number;
  telemetryType?: string;
}

export async function listLogStores(options: ListLogStoresOptions) {
  const client = createAliyunLogClient();
  const response = await client.listLogStores(
    options.projectName,
    new ListLogStoresRequest({
      logstoreName: options.logstoreName,
      mode: options.mode,
      offset: options.offset ?? 0,
      size: options.size ?? 200,
      telemetryType: options.telemetryType
    })
  );

  const body = response.body;

  return {
    projectName: options.projectName,
    total: body?.total ?? 0,
    count: body?.count ?? 0,
    logstores: body?.logstores ?? []
  };
}
