/**
 * Replay Engine Module
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG, DYNAMIC_FIELDS } from '../config/constants.js';
import type { TrafficEntry } from './proxy.js';

export interface ReplayOptions {
  target: string;
  concurrency: number;
  timeout: number;
  delay: number;
  ignoreFields: string[];
}

export interface ReplayResult {
  id: string;
  original: TrafficEntry;
  replay: {
    status: number;
    headers: Record<string, string>;
    body: string | null;
    duration: number;
  };
  success: boolean;
  match: boolean;
  differences: Difference[];
}

export interface Difference {
  path: string;
  expected: any;
  actual: any;
  type: 'status' | 'header' | 'body';
}

export class ReplayEngine {
  private options: ReplayOptions;

  constructor(options: Partial<ReplayOptions> = {}) {
    this.options = {
      target: options.target || 'http://localhost:8080',
      concurrency: options.concurrency || DEFAULT_CONFIG.CONCURRENCY,
      timeout: options.timeout || DEFAULT_CONFIG.TIMEOUT,
      delay: options.delay || 0,
      ignoreFields: options.ignoreFields || [],
    };
  }

  async execute(traffic: TrafficEntry[]): Promise<ReplayResult[]> {
    const results: ReplayResult[] = [];
    const total = traffic.length;

    logger.info(`🚀 Replaying ${total} requests...\n`);

    // Process in batches based on concurrency
    for (let i = 0; i < total; i += this.options.concurrency) {
      const batch = traffic.slice(i, i + this.options.concurrency);
      const batchPromises = batch.map((entry, index) =>
        this.replayRequest(entry, i + index + 1, total)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Progress bar
      const current = Math.min(i + this.options.concurrency, total);
      process.stdout.write(`\r${logger.progress(current, total)}`);

      // Delay between batches
      if (this.options.delay > 0 && i + this.options.concurrency < total) {
        await this.sleep(this.options.delay);
      }
    }

    console.log('\n');
    return results;
  }

  async replayRequest(entry: TrafficEntry, current: number, total: number): Promise<ReplayResult> {
    const startTime = Date.now();

    try {
      const response = await this.makeRequest(entry);
      const duration = Date.now() - startTime;

      const differences = this.compareResponses(entry, response);
      const match = differences.length === 0;

      return {
        id: entry.id,
        original: entry,
        replay: {
          status: response.status,
          headers: response.headers,
          body: response.body,
          duration,
        },
        success: true,
        match,
        differences,
      };
    } catch (error) {
      return {
        id: entry.id,
        original: entry,
        replay: {
          status: 0,
          headers: {},
          body: null,
          duration: Date.now() - startTime,
        },
        success: false,
        match: false,
        differences: [{
          path: 'error',
          expected: 'success',
          actual: error instanceof Error ? error.message : String(error),
          type: 'status',
        }],
      };
    }
  }

  private makeRequest(entry: TrafficEntry): Promise<{ status: number; headers: Record<string, string>; body: string | null }> {
    return new Promise((resolve, reject) => {
      const targetUrl = new URL(this.options.target);
      const path = entry.path + this.buildQueryString(entry.query);

      const options: http.RequestOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path,
        method: entry.method,
        headers: this.filterHeaders(entry.headers),
        timeout: this.options.timeout,
      };

      const req = (targetUrl.protocol === 'https:' ? https : http).request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const headers: Record<string, string> = {};
          Object.entries(res.headers).forEach(([key, value]) => {
            if (value) {
              headers[key] = Array.isArray(value) ? value.join(', ') : value;
            }
          });

          resolve({
            status: res.statusCode || 0,
            headers,
            body: Buffer.concat(chunks).toString('utf8') || null,
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (entry.body) {
        req.write(entry.body);
      }

      req.end();
    });
  }

  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    const skipHeaders = ['host', 'content-length', 'connection'];

    Object.entries(headers).forEach(([key, value]) => {
      if (!skipHeaders.includes(key.toLowerCase())) {
        filtered[key] = value;
      }
    });

    return filtered;
  }

  private buildQueryString(query: Record<string, string>): string {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      params.append(key, value);
    });
    const str = params.toString();
    return str ? `?${str}` : '';
  }

  private compareResponses(original: TrafficEntry, replay: { status: number; headers: Record<string, string>; body: string | null }): Difference[] {
    const differences: Difference[] = [];

    // Compare status
    if (original.response.status !== replay.status) {
      differences.push({
        path: 'status',
        expected: original.response.status,
        actual: replay.status,
        type: 'status',
      });
    }

    // Compare body (if JSON)
    if (original.response.body && replay.body) {
      try {
        const originalJson = JSON.parse(original.response.body);
        const replayJson = JSON.parse(replay.body);
        const bodyDiffs = this.compareJson(originalJson, replayJson, 'body');
        differences.push(...bodyDiffs);
      } catch {
        // Not JSON, compare as string
        if (original.response.body !== replay.body) {
          differences.push({
            path: 'body',
            expected: '(different)',
            actual: '(different)',
            type: 'body',
          });
        }
      }
    }

    return differences;
  }

  private compareJson(expected: any, actual: any, path: string): Difference[] {
    const differences: Difference[] = [];

    // Check if field should be ignored
    const fieldName = path.split('.').pop() || '';
    if (this.shouldIgnoreField(fieldName)) {
      return differences;
    }

    if (typeof expected !== typeof actual) {
      differences.push({
        path,
        expected,
        actual,
        type: 'body',
      });
      return differences;
    }

    if (typeof expected === 'object' && expected !== null) {
      if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || expected.length !== actual.length) {
          differences.push({
            path,
            expected: `array[${expected.length}]`,
            actual: `array[${Array.isArray(actual) ? actual.length : 'not array'}]`,
            type: 'body',
          });
        } else {
          for (let i = 0; i < expected.length; i++) {
            const itemDiffs = this.compareJson(expected[i], actual[i], `${path}[${i}]`);
            differences.push(...itemDiffs);
          }
        }
      } else {
        const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
        for (const key of allKeys) {
          if (!(key in expected)) {
            differences.push({
              path: `${path}.${key}`,
              expected: '(missing)',
              actual: actual[key],
              type: 'body',
            });
          } else if (!(key in actual)) {
            differences.push({
              path: `${path}.${key}`,
              expected: expected[key],
              actual: '(missing)',
              type: 'body',
            });
          } else {
            const nestedDiffs = this.compareJson(expected[key], actual[key], `${path}.${key}`);
            differences.push(...nestedDiffs);
          }
        }
      }
    } else if (expected !== actual) {
      differences.push({
        path,
        expected,
        actual,
        type: 'body',
      });
    }

    return differences;
  }

  private shouldIgnoreField(fieldName: string): boolean {
    const ignoreList = [...DYNAMIC_FIELDS, ...this.options.ignoreFields];
    return ignoreList.some(field =>
      fieldName.toLowerCase().includes(field.toLowerCase())
    );
  }

  printSummary(results: ReplayResult[]): void {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const matched = results.filter(r => r.match).length;
    const failed = total - successful;
    const mismatched = successful - matched;

    logger.info('📊 Replay Summary:');
    logger.info(`   Total Requests: ${total}`);
    logger.success(`   Successful: ${successful}`);
    logger.error(`   Failed: ${failed}`);
    logger.success(`   Matched: ${matched}`);

    if (mismatched > 0) {
      logger.warn(`   Mismatched: ${mismatched}`);
    }

    // Show first few failures
    const failures = results.filter(r => !r.success || !r.match).slice(0, 5);
    if (failures.length > 0) {
      logger.info('\n❌ Top Issues:');
      failures.forEach(f => {
        logger.error(`   ${f.original.method} ${f.original.path}`);
        if (f.differences.length > 0) {
          f.differences.forEach(d => {
            logger.info(`      ${d.path}: expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.actual)}`);
          });
        }
      });
    }
  }

  async generateReport(results: ReplayResult[], outPath: string): Promise<void> {
    const fs = await import('fs/promises');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>APIReplay Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #2563eb; }
    .stat-label { color: #666; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8f9fa; font-weight: 600; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    .warning { color: #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 APIReplay Report</h1>
    <div class="summary">
      <div class="stat">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #22c55e;">${results.filter(r => r.success).length}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #ef4444;">${results.filter(r => !r.success).length}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #2563eb;">${results.filter(r => r.match).length}</div>
        <div class="stat-label">Matched</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Path</th>
          <th>Original Status</th>
          <th>Replay Status</th>
          <th>Duration</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => `
        <tr>
          <td>${r.original.method}</td>
          <td>${r.original.path}</td>
          <td>${r.original.response.status}</td>
          <td>${r.replay.status || '-'}</td>
          <td>${r.replay.duration}ms</td>
          <td class="${r.match ? 'success' : r.success ? 'warning' : 'error'}">
            ${r.match ? '✓ Match' : r.success ? '⚠ Diff' : '✗ Failed'}
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    await fs.writeFile(outPath, html, 'utf8');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
