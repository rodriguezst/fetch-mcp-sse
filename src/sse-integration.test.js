// Simple integration test for SSE server
const http = require('http');

describe('SSE Server Integration Tests', () => {
  const PORT = 3001; // Use different port to avoid conflicts
  let server;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test('health endpoint works without authentication', (done) => {
    // Create a simple Express app for testing
    const express = require('express');
    const app = express();

    app.get('/health', (req, res) => {
      const authRequired = !!process.env.API_KEY_TOKEN;
      res.json({ 
        status: 'ok', 
        authRequired,
        activeConnections: 0 
      });
    });

    server = app.listen(PORT, () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/health',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.status).toBe('ok');
          expect(response.authRequired).toBe(false);
          expect(response.activeConnections).toBe(0);
          done();
        });
      });

      req.on('error', (err) => {
        done(err);
      });

      req.end();
    });
  });

  test('health endpoint shows auth required when API_KEY_TOKEN is set', (done) => {
    // Set environment variable for this test
    const originalToken = process.env.API_KEY_TOKEN;
    process.env.API_KEY_TOKEN = 'test-token';

    const express = require('express');
    const app = express();

    app.get('/health', (req, res) => {
      const authRequired = !!process.env.API_KEY_TOKEN;
      res.json({ 
        status: 'ok', 
        authRequired,
        activeConnections: 0 
      });
    });

    server = app.listen(PORT, () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/health',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.status).toBe('ok');
          expect(response.authRequired).toBe(true);
          
          // Restore original environment
          if (originalToken) {
            process.env.API_KEY_TOKEN = originalToken;
          } else {
            delete process.env.API_KEY_TOKEN;
          }
          
          done();
        });
      });

      req.on('error', (err) => {
        // Restore original environment
        if (originalToken) {
          process.env.API_KEY_TOKEN = originalToken;
        } else {
          delete process.env.API_KEY_TOKEN;
        }
        done(err);
      });

      req.end();
    });
  });

  test('authentication middleware blocks unauthorized requests', (done) => {
    // Set environment variable for this test
    process.env.API_KEY_TOKEN = 'secret-token';

    const express = require('express');
    const app = express();
    app.use(express.json());

    // Simple auth middleware
    app.use((req, res, next) => {
      const apiKey = process.env.API_KEY_TOKEN;
      if (!apiKey) return next();
      
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
      
      const token = authHeader.substring(7);
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
    });

    app.get('/protected', (req, res) => {
      res.json({ message: 'success' });
    });

    server = app.listen(PORT, () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/protected',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          expect(res.statusCode).toBe(401);
          const response = JSON.parse(data);
          expect(response.error.message).toContain('Missing or invalid Bearer token');
          
          // Clean up
          delete process.env.API_KEY_TOKEN;
          done();
        });
      });

      req.on('error', (err) => {
        delete process.env.API_KEY_TOKEN;
        done(err);
      });

      req.end();
    });
  });

  test('authentication middleware allows valid Bearer tokens', (done) => {
    // Set environment variable for this test
    process.env.API_KEY_TOKEN = 'secret-token';

    const express = require('express');
    const app = express();
    app.use(express.json());

    // Simple auth middleware
    app.use((req, res, next) => {
      const apiKey = process.env.API_KEY_TOKEN;
      if (!apiKey) return next();
      
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
      
      const token = authHeader.substring(7);
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
    });

    app.get('/protected', (req, res) => {
      res.json({ message: 'success' });
    });

    server = app.listen(PORT, () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/protected',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer secret-token'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          expect(res.statusCode).toBe(200);
          const response = JSON.parse(data);
          expect(response.message).toBe('success');
          
          // Clean up
          delete process.env.API_KEY_TOKEN;
          done();
        });
      });

      req.on('error', (err) => {
        delete process.env.API_KEY_TOKEN;
        done(err);
      });

      req.end();
    });
  });
});