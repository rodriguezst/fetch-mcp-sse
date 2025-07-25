#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestPayloadSchema } from "./types.js";
import { Fetcher } from "./Fetcher.js";

// Authentication middleware
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = process.env.API_KEY_TOKEN;
  
  // If no API key is configured, skip authentication
  if (!apiKey) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Missing or invalid Bearer token',
      },
      id: null,
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (token !== apiKey) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid Bearer token',
      },
      id: null,
    });
  }
  
  next();
};

// Create MCP server with fetch capabilities
const createMcpServer = () => {
  const server = new Server(
    {
      name: "zcaceres/fetch-sse",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "fetch_html",
          description: "Fetch a website and return the content as HTML",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "URL of the website to fetch",
              },
              headers: {
                type: "object",
                description: "Optional headers to include in the request",
              },
              max_length: {
                type: "number",
                description: "Maximum number of characters to return (default: 5000)",
              },
              start_index: {
                type: "number",
                description: "Start content from this character index (default: 0)",
              },
            },
            required: ["url"],
          },
        },
        {
          name: "fetch_markdown",
          description: "Fetch a website and return the content as Markdown",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "URL of the website to fetch",
              },
              headers: {
                type: "object",
                description: "Optional headers to include in the request",
              },
              max_length: {
                type: "number",
                description: "Maximum number of characters to return (default: 5000)",
              },
              start_index: {
                type: "number",
                description: "Start content from this character index (default: 0)",
              },
            },
            required: ["url"],
          },
        },
        {
          name: "fetch_txt",
          description:
            "Fetch a website, return the content as plain text (no HTML)",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "URL of the website to fetch",
              },
              headers: {
                type: "object",
                description: "Optional headers to include in the request",
              },
              max_length: {
                type: "number",
                description: "Maximum number of characters to return (default: 5000)",
              },
              start_index: {
                type: "number",
                description: "Start content from this character index (default: 0)",
              },
            },
            required: ["url"],
          },
        },
        {
          name: "fetch_json",
          description: "Fetch a JSON file from a URL",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "URL of the JSON to fetch",
              },
              headers: {
                type: "object",
                description: "Optional headers to include in the request",
              },
              max_length: {
                type: "number",
                description: "Maximum number of characters to return (default: 5000)",
              },
              start_index: {
                type: "number",
                description: "Start content from this character index (default: 0)",
              },
            },
            required: ["url"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const validatedArgs = RequestPayloadSchema.parse(args);

    if (request.params.name === "fetch_html") {
      const fetchResult = await Fetcher.html(validatedArgs);
      return fetchResult;
    }
    if (request.params.name === "fetch_json") {
      const fetchResult = await Fetcher.json(validatedArgs);
      return fetchResult;
    }
    if (request.params.name === "fetch_txt") {
      const fetchResult = await Fetcher.txt(validatedArgs);
      return fetchResult;
    }
    if (request.params.name === "fetch_markdown") {
      const fetchResult = await Fetcher.markdown(validatedArgs);
      return fetchResult;
    }
    throw new Error("Tool not found");
  });

  return server;
};

// Create Express application
const app = express();
app.use(express.json());

// Configure CORS
app.use(cors({
  origin: '*', // Allow all origins - adjust as needed for production
  exposedHeaders: ['Mcp-Session-Id']
}));

// Store transports by session ID
const transports: Record<string, SSEServerTransport> = {};

// SSE endpoint to establish the event stream
app.get('/sse', authMiddleware, async (req, res) => {
  console.log('Received GET request to /sse');
  try {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    
    // Clean up transport when connection closes
    res.on("close", () => {
      console.log(`Transport closed for session ${transport.sessionId}`);
      delete transports[transport.sessionId];
    });

    const server = createMcpServer();
    await server.connect(transport);
    
    console.log(`SSE connection established with session ID: ${transport.sessionId}`);
  } catch (error) {
    console.error('Error establishing SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// POST endpoint to receive messages from clients
app.post("/messages", authMiddleware, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  
  if (!sessionId) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: sessionId query parameter is required',
      },
      id: null,
    });
  }
  
  const transport = transports[sessionId];
  if (!transport) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No transport found for sessionId',
      },
      id: null,
    });
  }
  
  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('Error handling POST message:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const authRequired = !!process.env.API_KEY_TOKEN;
  res.json({ 
    status: 'ok', 
    authRequired,
    activeConnections: Object.keys(transports).length 
  });
});

// Start the server
const PORT = process.env.PORT || 3000;

export const startSSEServer = () => {
  return app.listen(PORT, () => {
    console.log(`Fetch MCP SSE server listening on port ${PORT}`);
    console.log(`
======================================
FETCH MCP SSE SERVER
======================================

Endpoints:
- GET  /sse      : Establish SSE connection
- POST /messages : Send MCP messages (requires sessionId query param)
- GET  /health   : Server health check

Authentication: ${process.env.API_KEY_TOKEN ? 'Enabled (Bearer token required)' : 'Disabled'}

Usage:
1. GET /sse to establish SSE connection and receive session ID
2. POST /messages?sessionId=<session_id> to send MCP requests

Available tools:
- fetch_html     : Fetch content as HTML
- fetch_markdown : Fetch content as Markdown  
- fetch_txt      : Fetch content as plain text
- fetch_json     : Fetch JSON data
`);
  });
};

// If this file is run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startSSEServer();
}