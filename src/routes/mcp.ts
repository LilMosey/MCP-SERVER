import { randomUUID } from "node:crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Router } from "express";

import { createMcpServer } from "../mcp-server.js";

export const mcpRouter = Router();

interface McpSession {
  server: ReturnType<typeof createMcpServer>;
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, McpSession>();

async function cleanupSession(sessionId: string | undefined) {
  if (!sessionId) {
    return;
  }

  const session = sessions.get(sessionId);
  sessions.delete(sessionId);
  await session?.server.close();
}

function readSessionId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

mcpRouter.post("/", async (request, response) => {
  const sessionId = readSessionId(request.headers["mcp-session-id"]);

  try {
    const existingSession = sessionId ? sessions.get(sessionId) : undefined;
    if (existingSession) {
      await existingSession.transport.handleRequest(
        request,
        response,
        request.body
      );
      return;
    }

    if (sessionId || !isInitializeRequest(request.body)) {
      response.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided."
        },
        id: null
      });
      return;
    }

    const server = createMcpServer();
    let transport: StreamableHTTPServerTransport;

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, {
          server,
          transport
        });
      },
      onsessionclosed: async (closedSessionId) => {
        await cleanupSession(closedSessionId);
      }
    });

    transport.onclose = () => {
      void cleanupSession(transport.sessionId);
    };

    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    console.error("MCP request failed.", error);
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: null
      });
    }
  }
});

mcpRouter.get("/", async (request, response) => {
  const sessionId = readSessionId(request.headers["mcp-session-id"]);
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    response.status(400).send("Invalid or missing session ID.");
    return;
  }

  await session.transport.handleRequest(request, response);
});

mcpRouter.delete("/", async (request, response) => {
  const sessionId = readSessionId(request.headers["mcp-session-id"]);
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    response.status(400).send("Invalid or missing session ID.");
    return;
  }

  await session.transport.handleRequest(request, response);
});
