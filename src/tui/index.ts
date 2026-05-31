/**
 * TUI (Terminal User Interface) Module
 * Simple interactive dashboard for APIReplay-CLI
 */

import readline from 'readline';
import { Storage } from '../core/storage.js';
import { ProxyServer } from '../core/proxy.js';
import { ReplayEngine } from '../core/replay.js';
import { MockServer } from '../core/mock.js';
import { DiffEngine } from '../core/diff.js';
import { logger } from '../utils/logger.js';
import { COLORS } from '../config/constants.js';

export class TUI {
  private rl: readline.Interface;
  private storage: Storage;
  private currentFile: string | null = null;
  private traffic: any[] = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.storage = new Storage();
  }

  async start(): Promise<void> {
    this.clearScreen();
    this.printBanner();

    while (true) {
      const choice = await this.showMainMenu();

      switch (choice) {
        case '1':
          await this.recordTraffic();
          break;
        case '2':
          await this.loadTraffic();
          break;
        case '3':
          await this.viewTraffic();
          break;
        case '4':
          await this.replayTraffic();
          break;
        case '5':
          await this.startMock();
          break;
        case '6':
          await this.compareTraffic();
          break;
        case '7':
          await this.exportTraffic();
          break;
        case '0':
        case 'q':
          this.quit();
          return;
        default:
          console.log('Invalid option');
      }

      await this.pressEnterToContinue();
    }
  }

  private clearScreen(): void {
    console.clear();
  }

  private printBanner(): void {
    console.log(`
${COLORS.FG_CYAN}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎬 APIReplay-CLI - Interactive TUI Dashboard           ║
║   HTTP API Traffic Recording & Intelligent Replay Engine  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${COLORS.RESET}`);
  }

  private async showMainMenu(): Promise<string> {
    console.log(`
${COLORS.FG_YELLOW}Main Menu:${COLORS.RESET}
${this.currentFile ? `${COLORS.FG_GREEN}📂 Current File: ${this.currentFile} (${this.traffic.length} requests)${COLORS.RESET}` : `${COLORS.FG_DIM}📂 No file loaded${COLORS.RESET}`}

  1. 🎥 Record Traffic
  2. 📂 Load Traffic File
  3. 👁️  View Traffic
  4. ▶️  Replay Traffic
  5. 🎭 Start Mock Server
  6. 🔍 Compare Environments
  7. 📤 Export Traffic
  0. ❌ Quit
`);

    return await this.ask('Select option: ');
  }

  private async recordTraffic(): Promise<void> {
    console.log(`\n${COLORS.FG_CYAN}🎥 Record Traffic${COLORS.RESET}\n`);

    const target = await this.ask('Target API URL (e.g., http://localhost:8080): ');
    const port = await this.ask('Proxy port (default: 3000): ');
    const filename = await this.ask('Output filename (default: traffic.json): ');

    const proxyPort = parseInt(port) || 3000;
    const outputFile = filename || 'traffic.json';

    console.log(`\n${COLORS.FG_GREEN}Starting proxy server...${COLORS.RESET}`);
    console.log(`  Target: ${target}`);
    console.log(`  Proxy: http://localhost:${proxyPort}`);
    console.log(`  Output: ${outputFile}`);
    console.log(`\n${COLORS.FG_YELLOW}Press Ctrl+C to stop recording${COLORS.RESET}\n`);

    const proxy = new ProxyServer({
      target,
      port: proxyPort,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      includeHeaders: true,
      includeBody: true,
    });

    await proxy.start();

    return new Promise((resolve) => {
      process.on('SIGINT', async () => {
        console.log('\nStopping recorder...');
        const traffic = proxy.getTraffic();
        await this.storage.save(outputFile, traffic);
        console.log(`${COLORS.FG_GREEN}✅ Saved ${traffic.length} requests to ${outputFile}${COLORS.RESET}`);
        await proxy.stop();
        this.currentFile = outputFile;
        this.traffic = traffic;
        resolve();
      });
    });
  }

  private async loadTraffic(): Promise<void> {
    console.log(`\n${COLORS.FG_CYAN}📂 Load Traffic File${COLORS.RESET}\n`);

    const filename = await this.ask('Traffic file path: ');

    try {
      this.traffic = await this.storage.load(filename);
      this.currentFile = filename;
      console.log(`${COLORS.FG_GREEN}✅ Loaded ${this.traffic.length} requests${COLORS.RESET}`);
    } catch (err) {
      console.log(`${COLORS.FG_RED}❌ Failed to load file${COLORS.RESET}`);
    }
  }

  private async viewTraffic(): Promise<void> {
    if (this.traffic.length === 0) {
      console.log(`${COLORS.FG_YELLOW}⚠️  No traffic loaded${COLORS.RESET}`);
      return;
    }

    console.log(`\n${COLORS.FG_CYAN}👁️  Traffic Overview${COLORS.RESET}\n`);

    // Summary stats
    const methods = this.traffic.reduce((acc, t) => {
      acc[t.method] = (acc[t.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusCodes = this.traffic.reduce((acc, t) => {
      const code = Math.floor(t.response.status / 100) * 100;
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log(`${COLORS.FG_YELLOW}Summary:${COLORS.RESET}`);
    console.log(`  Total Requests: ${this.traffic.length}`);

    console.log(`\n${COLORS.FG_YELLOW}Methods:${COLORS.RESET}`);
    Object.entries(methods).forEach(([method, count]) => {
      console.log(`  ${method}: ${count}`);
    });

    console.log(`\n${COLORS.FG_YELLOW}Status Codes:${COLORS.RESET}`);
    Object.entries(statusCodes).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });

    // Show recent requests
    console.log(`\n${COLORS.FG_YELLOW}Recent Requests:${COLORS.RESET}`);
    this.traffic.slice(-10).forEach((t, i) => {
      const color = t.response.status >= 400 ? COLORS.FG_RED : COLORS.FG_GREEN;
      console.log(`  ${i + 1}. ${t.method} ${t.path} ${color}${t.response.status}${COLORS.RESET}`);
    });
  }

  private async replayTraffic(): Promise<void> {
    if (this.traffic.length === 0) {
      console.log(`${COLORS.FG_YELLOW}⚠️  No traffic loaded${COLORS.RESET}`);
      return;
    }

    console.log(`\n${COLORS.FG_CYAN}▶️  Replay Traffic${COLORS.RESET}\n`);

    const target = await this.ask('Target API URL: ');
    const concurrency = await this.ask('Concurrency (default: 10): ');

    const replay = new ReplayEngine({
      target,
      concurrency: parseInt(concurrency) || 10,
    });

    const results = await replay.execute(this.traffic);
    replay.printSummary(results);
  }

  private async startMock(): Promise<void> {
    if (this.traffic.length === 0) {
      console.log(`${COLORS.FG_YELLOW}⚠️  No traffic loaded${COLORS.RESET}`);
      return;
    }

    console.log(`\n${COLORS.FG_CYAN}🎭 Start Mock Server${COLORS.RESET}\n`);

    const port = await this.ask('Mock server port (default: 8080): ');
    const mockPort = parseInt(port) || 8080;

    const mock = new MockServer({
      traffic: this.traffic,
      port: mockPort,
      delay: 0,
      errorRate: 0,
      cors: true,
    });

    await mock.start();

    console.log(`${COLORS.FG_GREEN}✅ Mock server running at http://localhost:${mockPort}${COLORS.RESET}`);
    console.log(`${COLORS.FG_YELLOW}Press Ctrl+C to stop${COLORS.RESET}`);

    return new Promise((resolve) => {
      process.on('SIGINT', async () => {
        await mock.stop();
        resolve();
      });
    });
  }

  private async compareTraffic(): Promise<void> {
    if (this.traffic.length === 0) {
      console.log(`${COLORS.FG_YELLOW}⚠️  No traffic loaded${COLORS.RESET}`);
      return;
    }

    console.log(`\n${COLORS.FG_CYAN}🔍 Compare Environments${COLORS.RESET}\n`);

    const primary = await this.ask('Primary environment URL: ');
    const secondary = await this.ask('Secondary environment URL: ');

    const diff = new DiffEngine({
      primary,
      secondary,
      ignoreFields: [],
      threshold: 100,
    });

    const results = await diff.compare(this.traffic);
    diff.printSummary(results);
  }

  private async exportTraffic(): Promise<void> {
    if (this.traffic.length === 0) {
      console.log(`${COLORS.FG_YELLOW}⚠️  No traffic loaded${COLORS.RESET}`);
      return;
    }

    console.log(`\n${COLORS.FG_CYAN}📤 Export Traffic${COLORS.RESET}\n`);
    console.log('Available formats: har, curl, postman, openapi');

    const format = await this.ask('Export format: ');
    const filename = await this.ask('Output filename: ');

    try {
      await this.storage.export(this.traffic, format, filename);
      console.log(`${COLORS.FG_GREEN}✅ Exported to ${filename}${COLORS.RESET}`);
    } catch (err) {
      console.log(`${COLORS.FG_RED}❌ Export failed: ${err}${COLORS.RESET}`);
    }
  }

  private async ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private async pressEnterToContinue(): Promise<void> {
    console.log('');
    await this.ask(`${COLORS.FG_DIM}Press Enter to continue...${COLORS.RESET}`);
    this.clearScreen();
    this.printBanner();
  }

  private quit(): void {
    console.log(`\n${COLORS.FG_GREEN}👋 Goodbye!${COLORS.RESET}\n`);
    this.rl.close();
  }
}
