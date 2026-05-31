/**
 * Command Handler Module
 */

import { ProxyServer } from '../core/proxy.js';
import { ReplayEngine } from '../core/replay.js';
import { MockServer } from '../core/mock.js';
import { DiffEngine } from '../core/diff.js';
import { Storage } from '../core/storage.js';
import { TUI } from '../tui/index.js';
import { parseArgs } from '../utils/args.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG } from '../config/constants.js';

export class Command {
  private storage: Storage;

  constructor() {
    this.storage = new Storage();
  }

  /**
   * Record HTTP traffic
   */
  async record(args: string[]): Promise<void> {
    const options = parseArgs(args, {
      target: { type: 'string', required: true, alias: 't' },
      port: { type: 'number', default: DEFAULT_CONFIG.PROXY_PORT, alias: 'p' },
      out: { type: 'string', default: 'traffic.json', alias: 'o' },
      methods: { type: 'array', default: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], alias: 'm' },
      headers: { type: 'boolean', default: true, alias: 'h' },
      body: { type: 'boolean', default: true, alias: 'b' },
      filter: { type: 'string', alias: 'f' },
    });

    logger.info('🎥 Starting traffic recording...');
    logger.info(`   Target: ${options.target}`);
    logger.info(`   Proxy Port: ${options.port}`);
    logger.info(`   Output: ${options.out}`);

    const proxy = new ProxyServer({
      target: options.target,
      port: options.port,
      methods: options.methods,
      includeHeaders: options.headers,
      includeBody: options.body,
      filter: options.filter,
    });

    await proxy.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\n🛑 Stopping recorder...');
      const traffic = proxy.getTraffic();
      await this.storage.save(options.out, traffic);
      logger.info(`✅ Saved ${traffic.length} requests to ${options.out}`);
      await proxy.stop();
      process.exit(0);
    });

    logger.info('\n📡 Recording... Press Ctrl+C to stop and save\n');
  }

  /**
   * Replay recorded traffic
   */
  async replay(args: string[]): Promise<void> {
    const options = parseArgs(args, {
      file: { type: 'string', required: true, alias: 'f' },
      target: { type: 'string', required: true, alias: 't' },
      concurrency: { type: 'number', default: DEFAULT_CONFIG.CONCURRENCY, alias: 'c' },
      timeout: { type: 'number', default: DEFAULT_CONFIG.TIMEOUT, alias: 'T' },
      delay: { type: 'number', default: 0, alias: 'd' },
      report: { type: 'string', alias: 'r' },
      'ignore-fields': { type: 'array', default: [], alias: 'i' },
    });

    logger.info('▶️  Starting traffic replay...');
    logger.info(`   File: ${options.file}`);
    logger.info(`   Target: ${options.target}`);
    logger.info(`   Concurrency: ${options.concurrency}`);

    const traffic = await this.storage.load(options.file);
    if (traffic.length === 0) {
      logger.error('❌ No traffic found in file');
      return;
    }

    logger.info(`   Loaded ${traffic.length} requests\n`);

    const replay = new ReplayEngine({
      target: options.target,
      concurrency: options.concurrency,
      timeout: options.timeout,
      delay: options.delay,
      ignoreFields: options['ignore-fields'],
    });

    const results = await replay.execute(traffic);

    if (options.report) {
      await replay.generateReport(results, options.report);
      logger.info(`\n📊 Report saved to: ${options.report}`);
    }

    replay.printSummary(results);
  }

  /**
   * Start mock server
   */
  async mock(args: string[]): Promise<void> {
    const options = parseArgs(args, {
      file: { type: 'string', required: true, alias: 'f' },
      port: { type: 'number', default: DEFAULT_CONFIG.MOCK_PORT, alias: 'p' },
      delay: { type: 'number', default: 0, alias: 'd' },
      'error-rate': { type: 'number', default: 0, alias: 'e' },
      cors: { type: 'boolean', default: true, alias: 'c' },
    });

    logger.info('🎭 Starting mock server...');
    logger.info(`   File: ${options.file}`);
    logger.info(`   Port: ${options.port}`);

    const traffic = await this.storage.load(options.file);
    if (traffic.length === 0) {
      logger.error('❌ No traffic found in file');
      return;
    }

    const mock = new MockServer({
      traffic,
      port: options.port,
      delay: options.delay,
      errorRate: options['error-rate'],
      cors: options.cors,
    });

    await mock.start();

    logger.info(`✅ Mock server running at http://localhost:${options.port}`);
    logger.info(`   Serving ${traffic.length} recorded responses\n`);

    process.on('SIGINT', async () => {
      logger.info('\n🛑 Stopping mock server...');
      await mock.stop();
      process.exit(0);
    });
  }

  /**
   * Compare responses between two environments
   */
  async diff(args: string[]): Promise<void> {
    const options = parseArgs(args, {
      file: { type: 'string', required: true, alias: 'f' },
      primary: { type: 'string', required: true, alias: 'p' },
      secondary: { type: 'string', required: true, alias: 's' },
      'ignore-fields': { type: 'array', default: [], alias: 'i' },
      threshold: { type: 'number', default: 100, alias: 't' },
      report: { type: 'string', alias: 'r' },
    });

    logger.info('🔍 Starting diff comparison...');
    logger.info(`   File: ${options.file}`);
    logger.info(`   Primary: ${options.primary}`);
    logger.info(`   Secondary: ${options.secondary}`);

    const traffic = await this.storage.load(options.file);
    if (traffic.length === 0) {
      logger.error('❌ No traffic found in file');
      return;
    }

    const diff = new DiffEngine({
      primary: options.primary,
      secondary: options.secondary,
      ignoreFields: options['ignore-fields'],
      threshold: options.threshold,
    });

    const results = await diff.compare(traffic);

    if (options.report) {
      await diff.generateReport(results, options.report);
      logger.info(`\n📊 Report saved to: ${options.report}`);
    }

    diff.printSummary(results);
  }

  /**
   * List recorded traffic files
   */
  async list(args: string[]): Promise<void> {
    const options = parseArgs(args, {
      dir: { type: 'string', default: '.', alias: 'd' },
    });

    await this.storage.list(options.dir);
  }

  /**
   * Export traffic to various formats
   */
  async export(args: string[]): Promise<void> {
    const options = parseArgs(args, {
      file: { type: 'string', required: true, alias: 'f' },
      format: { type: 'string', required: true, alias: 'fmt' },
      out: { type: 'string', required: true, alias: 'o' },
    });

    const supportedFormats = ['har', 'curl', 'postman', 'openapi'];
    if (!supportedFormats.includes(options.format)) {
      logger.error(`❌ Unsupported format: ${options.format}`);
      logger.info(`   Supported formats: ${supportedFormats.join(', ')}`);
      return;
    }

    logger.info(`📤 Exporting to ${options.format.toUpperCase()}...`);

    const traffic = await this.storage.load(options.file);
    if (traffic.length === 0) {
      logger.error('❌ No traffic found in file');
      return;
    }

    await this.storage.export(traffic, options.format, options.out);
    logger.info(`✅ Exported to: ${options.out}`);
  }

  /**
   * Launch TUI dashboard
   */
  async tui(args: string[]): Promise<void> {
    const tui = new TUI();
    await tui.start();
  }
}
