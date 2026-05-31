/**
 * Logger Utility
 */

import { COLORS } from '../config/constants.js';

class Logger {
  private silent = false;

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  info(message: string): void {
    if (this.silent) return;
    console.log(message);
  }

  success(message: string): void {
    if (this.silent) return;
    console.log(`${COLORS.FG_GREEN}${message}${COLORS.RESET}`);
  }

  error(message: string): void {
    if (this.silent) return;
    console.error(`${COLORS.FG_RED}${message}${COLORS.RESET}`);
  }

  warn(message: string): void {
    if (this.silent) return;
    console.warn(`${COLORS.FG_YELLOW}${message}${COLORS.RESET}`);
  }

  debug(message: string): void {
    if (this.silent || !process.env.DEBUG) return;
    console.log(`${COLORS.FG_DIM}${message}${COLORS.RESET}`);
  }

  table(data: Record<string, any>[]): void {
    if (this.silent) return;
    console.table(data);
  }

  json(data: any): void {
    if (this.silent) return;
    console.log(JSON.stringify(data, null, 2));
  }

  // Progress bar
  progress(current: number, total: number, width = 40): string {
    const percent = Math.round((current / total) * 100);
    const filled = Math.round((width * current) / total);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${COLORS.FG_CYAN}[${bar}]${COLORS.RESET} ${percent}% (${current}/${total})`;
  }

  // HTTP method colors
  method(method: string): string {
    const colors: Record<string, string> = {
      GET: COLORS.FG_GREEN,
      POST: COLORS.FG_BLUE,
      PUT: COLORS.FG_YELLOW,
      DELETE: COLORS.FG_RED,
      PATCH: COLORS.FG_MAGENTA,
      HEAD: COLORS.FG_CYAN,
      OPTIONS: COLORS.FG_WHITE,
    };
    return `${colors[method] || COLORS.FG_WHITE}${method}${COLORS.RESET}`;
  }

  // Status code colors
  status(code: number): string {
    if (code >= 200 && code < 300) {
      return `${COLORS.FG_GREEN}${code}${COLORS.RESET}`;
    } else if (code >= 300 && code < 400) {
      return `${COLORS.FG_YELLOW}${code}${COLORS.RESET}`;
    } else if (code >= 400) {
      return `${COLORS.FG_RED}${code}${COLORS.RESET}`;
    }
    return `${code}`;
  }
}

export const logger = new Logger();
