/**
 * Diff Engine Module - Compare responses between two environments
 */

import { ReplayEngine, ReplayOptions, ReplayResult } from './replay.js';
import { logger } from '../utils/logger.js';
import type { TrafficEntry } from './proxy.js';

export interface DiffOptions {
  primary: string;
  secondary: string;
  ignoreFields: string[];
  threshold: number;
}

export interface DiffResult {
  id: string;
  entry: TrafficEntry;
  primary: ReplayResult['replay'];
  secondary: ReplayResult['replay'];
  match: boolean;
  differences: Array<{
    path: string;
    primary: any;
    secondary: any;
    type: 'status' | 'body';
  }>;
}

export class DiffEngine {
  private options: DiffOptions;

  constructor(options: DiffOptions) {
    this.options = options;
  }

  async compare(traffic: TrafficEntry[]): Promise<DiffResult[]> {
    logger.info(`🔍 Comparing ${traffic.length} requests between environments...\n`);

    const results: DiffResult[] = [];

    // Create replay engines for both environments
    const primaryEngine = new ReplayEngine({
      target: this.options.primary,
      ignoreFields: this.options.ignoreFields,
    });

    const secondaryEngine = new ReplayEngine({
      target: this.options.secondary,
      ignoreFields: this.options.ignoreFields,
    });

    for (let i = 0; i < traffic.length; i++) {
      const entry = traffic[i];
      process.stdout.write(`\r${logger.progress(i + 1, traffic.length)}`);

      // Replay against both environments
      const [primaryResult, secondaryResult] = await Promise.all([
        primaryEngine.replayRequest(entry, i + 1, traffic.length),
        secondaryEngine.replayRequest(entry, i + 1, traffic.length),
      ]);

      // Compare the two responses
      const differences = this.compareResponses(
        primaryResult.replay,
        secondaryResult.replay
      );

      results.push({
        id: entry.id,
        entry,
        primary: primaryResult.replay,
        secondary: secondaryResult.replay,
        match: differences.length === 0,
        differences,
      });
    }

    console.log('\n');
    return results;
  }

  private compareResponses(
    primary: ReplayResult['replay'],
    secondary: ReplayResult['replay']
  ): DiffResult['differences'] {
    const differences: DiffResult['differences'] = [];

    // Compare status codes
    if (primary.status !== secondary.status) {
      differences.push({
        path: 'status',
        primary: primary.status,
        secondary: secondary.status,
        type: 'status',
      });
    }

    // Compare bodies (if both are JSON)
    if (primary.body && secondary.body) {
      try {
        const primaryJson = JSON.parse(primary.body);
        const secondaryJson = JSON.parse(secondary.body);
        const bodyDiffs = this.compareJson(primaryJson, secondaryJson, 'body');
        differences.push(...bodyDiffs);
      } catch {
        // Not JSON, skip body comparison
      }
    }

    return differences;
  }

  private compareJson(primary: any, secondary: any, path: string): DiffResult['differences'] {
    const differences: DiffResult['differences'] = [];

    if (typeof primary !== typeof secondary) {
      differences.push({
        path,
        primary,
        secondary,
        type: 'body',
      });
      return differences;
    }

    if (typeof primary === 'object' && primary !== null) {
      if (Array.isArray(primary)) {
        if (!Array.isArray(secondary) || primary.length !== secondary.length) {
          differences.push({
            path,
            primary: `array[${primary.length}]`,
            secondary: `array[${Array.isArray(secondary) ? secondary.length : 'not array'}]`,
            type: 'body',
          });
        } else {
          for (let i = 0; i < primary.length; i++) {
            const itemDiffs = this.compareJson(primary[i], secondary[i], `${path}[${i}]`);
            differences.push(...itemDiffs);
          }
        }
      } else {
        const allKeys = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
        for (const key of allKeys) {
          if (!(key in primary)) {
            differences.push({
              path: `${path}.${key}`,
              primary: '(missing)',
              secondary: secondary[key],
              type: 'body',
            });
          } else if (!(key in secondary)) {
            differences.push({
              path: `${path}.${key}`,
              primary: primary[key],
              secondary: '(missing)',
              type: 'body',
            });
          } else {
            const nestedDiffs = this.compareJson(primary[key], secondary[key], `${path}.${key}`);
            differences.push(...nestedDiffs);
          }
        }
      }
    } else if (primary !== secondary) {
      differences.push({
        path,
        primary,
        secondary,
        type: 'body',
      });
    }

    return differences;
  }

  printSummary(results: DiffResult[]): void {
    const total = results.length;
    const matched = results.filter(r => r.match).length;
    const mismatched = total - matched;

    logger.info('📊 Diff Summary:');
    logger.info(`   Total Requests: ${total}`);
    logger.success(`   Matched: ${matched}`);

    if (mismatched > 0) {
      logger.warn(`   Mismatched: ${mismatched}`);
    }

    // Show mismatches
    const mismatches = results.filter(r => !r.match);
    if (mismatches.length > 0) {
      logger.info('\n❌ Mismatches:');
      mismatches.slice(0, 10).forEach(m => {
        logger.error(`   ${m.entry.method} ${m.entry.path}`);
        m.differences.forEach(d => {
          logger.info(`      ${d.path}:`);
          logger.info(`        Primary:   ${JSON.stringify(d.primary)}`);
          logger.info(`        Secondary: ${JSON.stringify(d.secondary)}`);
        });
      });

      if (mismatches.length > 10) {
        logger.info(`\n   ... and ${mismatches.length - 10} more`);
      }
    }
  }

  async generateReport(results: DiffResult[], outPath: string): Promise<void> {
    const fs = await import('fs/promises');

    const matched = results.filter(r => r.match).length;
    const mismatched = results.length - matched;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>APIReplay Diff Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .envs { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .env { display: flex; justify-content: space-between; padding: 8px 0; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .stat { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #2563eb; }
    .stat-label { color: #666; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8f9fa; font-weight: 600; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    .diff-row { background: #fef2f2; }
    .diff-details { font-size: 12px; color: #666; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 APIReplay Diff Report</h1>
    <div class="envs">
      <div class="env"><strong>Primary:</strong> ${this.options.primary}</div>
      <div class="env"><strong>Secondary:</strong> ${this.options.secondary}</div>
    </div>
    <div class="summary">
      <div class="stat">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #22c55e;">${matched}</div>
        <div class="stat-label">Matched</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #ef4444;">${mismatched}</div>
        <div class="stat-label">Mismatched</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Path</th>
          <th>Primary Status</th>
          <th>Secondary Status</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => `
        <tr class="${r.match ? '' : 'diff-row'}">
          <td>${r.entry.method}</td>
          <td>${r.entry.path}</td>
          <td>${r.primary.status || '-'}</td>
          <td>${r.secondary.status || '-'}</td>
          <td class="${r.match ? 'success' : 'error'}">
            ${r.match ? '✓ Match' : '✗ Diff'}
            ${r.differences.length > 0 ? `<div class="diff-details">${r.differences.map(d => `${d.path}: ${JSON.stringify(d.primary)} vs ${JSON.stringify(d.secondary)}`).join('<br>')}</div>` : ''}
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
}
