/**
 * Mock Server Module
 */

import http from 'http';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG } from '../config/constants.js';
import type { TrafficEntry } from './proxy.js';

export interface MockOptions {
  traffic: TrafficEntry[];
  port: number;
  delay: number;
  errorRate: number;
  cors: boolean;
}

export class MockServer {
  private server: http.Server | null = null;
  private options: MockOptions;
  private routes: Map<string, TrafficEntry[]>;

  constructor(options: MockOptions) {
    this.options = options;
    this.routes = this.buildRoutes(options.traffic);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.options.port, () => {
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

  private buildRoutes(traffic: TrafficEntry[]): Map<string, TrafficEntry[]> {
    const routes = new Map<string, TrafficEntry[]>();

    traffic.forEach(entry => {
      const key = `${entry.method}:${entry.path}`;
      if (!routes.has(key)) {
        routes.set(key, []);
      }
      routes.get(key)!.push(entry);
    });

    return routes;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const path = req.url || '/';
    const method = req.method || 'GET';
    const key = `${method}:${path}`;

    // Add CORS headers
    if (this.options.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
    }

    // Simulate delay
    if (this.options.delay > 0) {
      await this.sleep(this.options.delay);
    }

    // Simulate error rate
    if (Math.random() * 100 < this.options.errorRate) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Simulated server error' }));
      return;
    }

    // Find matching route
    const entries = this.routes.get(key);

    if (entries && entries.length > 0) {
      // Use the first matching entry
      const entry = entries[0];

      // Set response headers
      Object.entries(entry.response.headers).forEach(([key, value]) => {
        // Skip certain headers
        if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      res.writeHead(entry.response.status);
      res.end(entry.response.body || '');

      logger.info(`${logger.method(method)} ${path} ${logger.status(entry.response.status)} (mock)`);
    } else {
      // Try to find a partial match (for path parameters)
      const fallbackEntry = this.findFallbackEntry(method, path);

      if (fallbackEntry) {
        Object.entries(fallbackEntry.response.headers).forEach(([key, value]) => {
          if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        });

        res.writeHead(fallbackEntry.response.status);
        res.end(fallbackEntry.response.body || '');

        logger.info(`${logger.method(method)} ${path} ${logger.status(fallbackEntry.response.status)} (mock, partial match)`);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({
          error: 'Not Found',
          message: `No mock data found for ${method} ${path}`,
          availableRoutes: Array.from(this.routes.keys()),
        }));

        logger.warn(`${logger.method(method)} ${path} 404 (not found)`);
      }
    }
  }

  private findFallbackEntry(method: string, path: string): TrafficEntry | null {
    // Try to match routes with path parameters
    for (const [key, entries] of this.routes) {
      const [routeMethod, routePath] = key.split(':');
      if (routeMethod !== method) continue;

      // Convert route path to regex (replace {param} with wildcard)
      const pattern = routePath.replace(/\{[^}]+\}/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(path)) {
        return entries[0];
      }
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
