/**
 * HTTP Proxy Server for Traffic Recording
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG, HTTP_METHODS } from '../config/constants.js';

export interface TrafficEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string | null;
    duration: number;
  };
}

export interface ProxyOptions {
  target: string;
  port: number;
  methods: string[];
  includeHeaders: boolean;
  includeBody: boolean;
  filter?: string;
}

export class ProxyServer {
  private server: http.Server | null = null;
  private traffic: TrafficEntry[] = [];
  private options: ProxyOptions;

  constructor(options: Partial<ProxyOptions> = {}) {
    this.options = {
      target: options.target || 'http://localhost:8080',
      port: options.port || DEFAULT_CONFIG.PROXY_PORT,
      methods: options.methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      includeHeaders: options.includeHeaders ?? true,
      includeBody: options.includeBody ?? true,
      filter: options.filter,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.options.port, () => {
        logger.success(`✅ Proxy server listening on port ${this.options.port}`);
        logger.info(`   Forwarding to: ${this.options.target}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getTraffic(): TrafficEntry[] {
    return this.traffic;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    const id = this.generateId();

    // Check method filter
    if (!this.options.methods.includes(req.method || 'GET')) {
      this.proxyRequest(req, res, () => {});
      return;
    }

    // Capture request data
    const requestData = await this.captureRequest(req);

    // Proxy the request
    this.proxyRequest(req, res, (responseData, responseBody) => {
      const duration = Date.now() - startTime;

      // Create traffic entry
      const entry: TrafficEntry = {
        id,
        timestamp: startTime,
        method: req.method || 'GET',
        url: requestData.url,
        path: requestData.path,
        query: requestData.query,
        headers: this.options.includeHeaders ? requestData.headers : {},
        body: this.options.includeBody ? requestData.body : null,
        response: {
          status: responseData.status,
          statusText: responseData.statusText,
          headers: this.options.includeHeaders ? responseData.headers : {},
          body: this.options.includeBody ? responseBody : null,
          duration,
        },
      };

      this.traffic.push(entry);

      // Log the request
      logger.info(
        `${logger.method(entry.method)} ${entry.path} ${logger.status(entry.response.status)} ${duration}ms`
      );
    });
  }

  private async captureRequest(req: http.IncomingMessage): Promise<{
    url: string;
    path: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body: string | null;
  }> {
    const targetUrl = new URL(this.options.target);
    const path = req.url || '/';
    const fullUrl = `${targetUrl.origin}${path}`;

    // Parse query parameters
    const urlObj = new URL(path, targetUrl.origin);
    const query: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Capture headers
    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    });

    // Capture body
    const body = await this.readBody(req);

    return {
      url: fullUrl,
      path: urlObj.pathname,
      query,
      headers,
      body,
    };
  }

  private proxyRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    callback: (responseData: { status: number; statusText: string; headers: Record<string, string> }, body: string | null) => void
  ): void {
    const targetUrl = new URL(this.options.target);
    const path = req.url || '/';

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: path,
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
    };

    const proxyReq = (targetUrl.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
      // Capture response headers
      const responseHeaders: Record<string, string> = {};
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value) {
          responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
        }
      });

      // Read response body
      this.readBody(proxyRes).then((body) => {
        // Send response to client
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        res.end(body);

        callback({
          status: proxyRes.statusCode || 200,
          statusText: proxyRes.statusMessage || 'OK',
          headers: responseHeaders,
        }, body);
      });
    });

    proxyReq.on('error', (err) => {
      logger.error(`Proxy error: ${err.message}`);
      res.writeHead(502);
      res.end('Bad Gateway');
    });

    // Forward request body
    req.pipe(proxyReq);
  }

  private readBody(stream: http.IncomingMessage): Promise<string | null> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body || null);
      });

      stream.on('error', () => {
        resolve(null);
      });
    });
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
