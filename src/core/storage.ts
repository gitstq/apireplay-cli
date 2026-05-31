/**
 * Traffic Storage Module
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import type { TrafficEntry } from './proxy.js';

export class Storage {
  /**
   * Save traffic to file
   */
  async save(filePath: string, traffic: TrafficEntry[]): Promise<void> {
    const data = JSON.stringify(traffic, null, 2);
    await fs.writeFile(filePath, data, 'utf8');
  }

  /**
   * Load traffic from file
   */
  async load(filePath: string): Promise<TrafficEntry[]> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as TrafficEntry[];
    } catch (err) {
      logger.error(`❌ Failed to load traffic file: ${filePath}`);
      return [];
    }
  }

  /**
   * List traffic files in directory
   */
  async list(dir: string): Promise<void> {
    try {
      const files = await fs.readdir(dir);
      const trafficFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));

      if (trafficFiles.length === 0) {
        logger.info('📂 No traffic files found');
        return;
      }

      logger.info(`📂 Found ${trafficFiles.length} traffic file(s):\n`);

      for (const file of trafficFiles) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        const size = this.formatSize(stats.size);
        logger.info(`   📄 ${file} (${size})`);
      }
    } catch (err) {
      logger.error(`❌ Failed to list directory: ${dir}`);
    }
  }

  /**
   * Export traffic to various formats
   */
  async export(traffic: TrafficEntry[], format: string, outPath: string): Promise<void> {
    switch (format) {
      case 'har':
        await this.exportHAR(traffic, outPath);
        break;
      case 'curl':
        await this.exportCurl(traffic, outPath);
        break;
      case 'postman':
        await this.exportPostman(traffic, outPath);
        break;
      case 'openapi':
        await this.exportOpenAPI(traffic, outPath);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportHAR(traffic: TrafficEntry[], outPath: string): Promise<void> {
    const har = {
      log: {
        version: '1.2',
        creator: { name: 'APIReplay-CLI', version: '1.0.0' },
        entries: traffic.map(entry => ({
          startedDateTime: new Date(entry.timestamp).toISOString(),
          time: entry.response.duration,
          request: {
            method: entry.method,
            url: entry.url,
            headers: Object.entries(entry.headers).map(([name, value]) => ({ name, value })),
            queryString: Object.entries(entry.query).map(([name, value]) => ({ name, value })),
            postData: entry.body ? { mimeType: 'application/json', text: entry.body } : undefined,
          },
          response: {
            status: entry.response.status,
            statusText: entry.response.statusText,
            headers: Object.entries(entry.response.headers).map(([name, value]) => ({ name, value })),
            content: entry.response.body ? {
              size: entry.response.body.length,
              mimeType: entry.response.headers['content-type'] || 'application/json',
              text: entry.response.body,
            } : undefined,
          },
        })),
      },
    };

    await fs.writeFile(outPath, JSON.stringify(har, null, 2), 'utf8');
  }

  private async exportCurl(traffic: TrafficEntry[], outPath: string): Promise<void> {
    const commands = traffic.map(entry => {
      const headers = Object.entries(entry.headers)
        .filter(([key]) => !['host', 'content-length'].includes(key.toLowerCase()))
        .map(([key, value]) => `-H "${key}: ${value}"`)
        .join(' ');

      const body = entry.body ? `-d '${entry.body.replace(/'/g, "'\\''")}'` : '';

      return `curl -X ${entry.method} ${headers} ${body} "${entry.url}"`;
    });

    await fs.writeFile(outPath, commands.join('\n\n'), 'utf8');
  }

  private async exportPostman(traffic: TrafficEntry[], outPath: string): Promise<void> {
    const collection = {
      info: {
        name: 'APIReplay Collection',
        description: 'Exported from APIReplay-CLI',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: traffic.map(entry => ({
        name: `${entry.method} ${entry.path}`,
        request: {
          method: entry.method,
          header: Object.entries(entry.headers).map(([key, value]) => ({ key, value })),
          url: {
            raw: entry.url,
            host: [entry.url.split('/')[2]],
            path: entry.path.split('/').filter(Boolean),
            query: Object.entries(entry.query).map(([key, value]) => ({ key, value })),
          },
          body: entry.body ? {
            mode: 'raw',
            raw: entry.body,
          } : undefined,
        },
      })),
    };

    await fs.writeFile(outPath, JSON.stringify(collection, null, 2), 'utf8');
  }

  private async exportOpenAPI(traffic: TrafficEntry[], outPath: string): Promise<void> {
    const paths: Record<string, any> = {};

    traffic.forEach(entry => {
      const pathKey = entry.path.replace(/\{[^}]+\}/g, '{}');
      const method = entry.method.toLowerCase();

      if (!paths[pathKey]) {
        paths[pathKey] = {};
      }

      paths[pathKey][method] = {
        summary: `${entry.method} ${entry.path}`,
        responses: {
          [entry.response.status]: {
            description: entry.response.statusText,
            content: entry.response.body ? {
              'application/json': {
                example: this.safeJsonParse(entry.response.body),
              },
            } : undefined,
          },
        },
      };
    });

    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'APIReplay Export',
        version: '1.0.0',
        description: 'Generated from recorded traffic',
      },
      paths,
    };

    await fs.writeFile(outPath, JSON.stringify(spec, null, 2), 'utf8');
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
