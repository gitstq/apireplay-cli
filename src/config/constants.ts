/**
 * Constants Configuration
 */

export const VERSION = '1.0.0';
export const AUTHOR = 'gitstq';
export const REPOSITORY = 'https://github.com/gitstq/APIReplay-CLI';
export const LICENSE = 'MIT';

export const DEFAULT_CONFIG = {
  PROXY_PORT: 3000,
  MOCK_PORT: 8080,
  TIMEOUT: 30000,
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB
  CONCURRENCY: 10,
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
} as const;

export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
] as const;

export const IGNORED_HEADERS = [
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
];

export const DYNAMIC_FIELDS = [
  'timestamp',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'id',
  'uuid',
  'guid',
  'token',
  'accessToken',
  'refreshToken',
  'traceId',
  'requestId',
  'correlationId',
  'date',
  'expires',
  'etag',
  'last-modified',
];

export const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  UNDERSCORE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',

  FG_BLACK: '\x1b[30m',
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',
  FG_DIM: '\x1b[2m',

  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',
} as const;
