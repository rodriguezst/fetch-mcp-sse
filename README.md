# Fetch MCP Server

![fetch mcp logo](logo.jpg)

This MCP server provides functionality to fetch web content in various formats, including HTML, JSON, plain text, and Markdown. It supports both STDIO and SSE (Server-Sent Events) transport protocols.

<a href="https://glama.ai/mcp/servers/nu09wf23ao">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/nu09wf23ao/badge" alt="Fetch Server MCP server" />
</a>

## Components

### Tools

- **fetch_html**
  - Fetch a website and return the content as HTML
  - Input:
    - `url` (string, required): URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the raw HTML content of the webpage

- **fetch_json**
  - Fetch a JSON file from a URL
  - Input:
    - `url` (string, required): URL of the JSON to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the parsed JSON content

- **fetch_txt**
  - Fetch a website and return the content as plain text (no HTML)
  - Input:
    - `url` (string, required): URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the text content of the webpage with HTML tags, scripts, and styles removed

- **fetch_markdown**
  - Fetch a website and return the content as Markdown
  - Input:
    - `url` (string, required): URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the content of the webpage converted to Markdown format

### Resources

This server does not provide any persistent resources. It's designed to fetch and transform web content on demand.

## Getting started

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the server: `npm run build`

### Usage

#### STDIO MCP Server (Original)

To use the STDIO server, you can run it directly:

```bash
npm start
```

This will start the Fetch MCP Server running on stdio.

#### SSE MCP Server (New)

To use the SSE server for remote clients:

```bash
npm run start:sse
```

This will start the SSE server on port 3000 (or the port specified in the `PORT` environment variable).

#### Authentication (Optional)

The SSE server supports optional Bearer token authentication. Set the `API_KEY_TOKEN` environment variable to enable it:

```bash
API_KEY_TOKEN=your-secret-token npm run start:sse
```

When authentication is enabled, all requests to the SSE server must include the `Authorization: Bearer your-secret-token` header.

### SSE Server Endpoints

- `GET /sse` - Establish SSE connection (returns session ID)
- `POST /messages?sessionId=<session_id>` - Send MCP requests
- `GET /health` - Server health check

### Usage with Desktop App (STDIO)

To integrate the STDIO server with a desktop app, add the following to your app's server configuration:

```json
{
  "mcpServers": {
    "fetch": {
      "command": "node",
      "args": [
        "{ABSOLUTE PATH TO FILE HERE}/dist/index.js"
      ]
    }
  }
}
```

### Usage with Remote Clients (SSE)

1. Start the SSE server: `npm run start:sse`
2. Establish SSE connection: `GET http://localhost:3000/sse` 
3. Extract session ID from the response
4. Send MCP requests: `POST http://localhost:3000/messages?sessionId=<session_id>`

Example with authentication:

```bash
# Start server with authentication
API_KEY_TOKEN=secret123 npm run start:sse

# Establish SSE connection
curl -H "Authorization: Bearer secret123" http://localhost:3000/sse

# Send fetch request (use session ID from SSE response)
curl -X POST \
  -H "Authorization: Bearer secret123" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch_html","arguments":{"url":"https://example.com"}}}' \
  "http://localhost:3000/messages?sessionId=YOUR_SESSION_ID"
```

## Features

- Fetches web content using modern fetch API
- Supports custom headers for requests
- Provides content in multiple formats: HTML, JSON, plain text, and Markdown
- Uses JSDOM for HTML parsing and text extraction
- Uses TurndownService for HTML to Markdown conversion

## Development

- Run `npm run dev` to start the TypeScript compiler in watch mode
- Use `npm test` to run the test suite

## License

This project is licensed under the MIT License.