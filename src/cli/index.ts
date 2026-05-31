/**
 * CLI Module - Command Line Interface Handler
 */

import { Command } from './command.js';
import { VERSION, AUTHOR, REPOSITORY } from '../config/constants.js';

export class CLI {
  private command: Command;

  constructor() {
    this.command = new Command();
  }

  async run(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      this.showHelp();
      return;
    }

    if (args[0] === '--version' || args[0] === '-v') {
      this.showVersion();
      return;
    }

    const [cmd, ...cmdArgs] = args;

    switch (cmd) {
      case 'record':
      case 'rec':
        await this.command.record(cmdArgs);
        break;
      case 'replay':
      case 'play':
        await this.command.replay(cmdArgs);
        break;
      case 'mock':
        await this.command.mock(cmdArgs);
        break;
      case 'diff':
      case 'compare':
        await this.command.diff(cmdArgs);
        break;
      case 'list':
      case 'ls':
        await this.command.list(cmdArgs);
        break;
      case 'export':
        await this.command.export(cmdArgs);
        break;
      case 'tui':
        await this.command.tui(cmdArgs);
        break;
      default:
        console.error(`❌ Unknown command: ${cmd}`);
        this.showHelp();
        process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(`
🎬 APIReplay-CLI v${VERSION} - HTTP API Traffic Recording & Replay Engine

Usage: apireplay <command> [options]

Commands:
  record, rec    🎥 Record HTTP traffic from a target API
  replay, play   ▶️  Replay recorded traffic against an API
  mock           🎭 Start a mock server from recorded traffic
  diff, compare  🔍 Compare responses between two environments
  list, ls       📋 List recorded traffic files
  export         📤 Export traffic to various formats
  tui            🖥️  Launch interactive TUI dashboard

Options:
  -h, --help     Show this help message
  -v, --version  Show version information

Examples:
  $ apireplay record --target http://localhost:8080 --port 3000 --out traffic.json
  $ apireplay replay --file traffic.json --target http://localhost:9090
  $ apireplay mock --file traffic.json --port 8080
  $ apireplay diff --file traffic.json --primary http://api1.com --secondary http://api2.com
  $ apireplay tui

For more information, visit: ${REPOSITORY}
`);
  }

  private showVersion(): void {
    console.log(`APIReplay-CLI v${VERSION} by ${AUTHOR}`);
  }
}

export { Command } from './command.js';
