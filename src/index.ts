#!/usr/bin/env node

/**
 * APIReplay-CLI - Lightweight Terminal HTTP API Traffic Recording & Intelligent Replay Engine
 * 轻量级终端HTTP API流量录制与智能回放引擎
 *
 * @author gitstq
 * @license MIT
 */

import { CLI } from './cli/index.js';

const cli = new CLI();
cli.run(process.argv.slice(2)).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
