/**
 * Argument Parser Utility
 */

export interface ArgSchema {
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: any;
  alias?: string;
}

export interface ParsedArgs {
  [key: string]: any;
}

export function parseArgs(args: string[], schema: Record<string, ArgSchema>): ParsedArgs {
  const result: ParsedArgs = {};
  const seen = new Set<string>();

  // Set defaults
  for (const [key, config] of Object.entries(schema)) {
    if (config.default !== undefined) {
      result[key] = config.default;
    }
  }

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const schemaKey = findSchemaKey(key, schema);

      if (!schemaKey) {
        throw new Error(`Unknown option: ${arg}`);
      }

      const config = schema[schemaKey];
      seen.add(schemaKey);

      if (config.type === 'boolean') {
        result[schemaKey] = true;
      } else {
        i++;
        if (i >= args.length) {
          throw new Error(`Missing value for: ${arg}`);
        }
        result[schemaKey] = parseValue(args[i], config.type);
      }
    } else if (arg.startsWith('-')) {
      const alias = arg.slice(1);
      const schemaKey = findSchemaKeyByAlias(alias, schema);

      if (!schemaKey) {
        throw new Error(`Unknown option: ${arg}`);
      }

      const config = schema[schemaKey];
      seen.add(schemaKey);

      if (config.type === 'boolean') {
        result[schemaKey] = true;
      } else {
        i++;
        if (i >= args.length) {
          throw new Error(`Missing value for: ${arg}`);
        }
        result[schemaKey] = parseValue(args[i], config.type);
      }
    }
  }

  // Check required fields
  for (const [key, config] of Object.entries(schema)) {
    if (config.required && !seen.has(key) && result[key] === undefined) {
      throw new Error(`Missing required option: --${key}`);
    }
  }

  return result;
}

function findSchemaKey(key: string, schema: Record<string, ArgSchema>): string | undefined {
  // Direct match
  if (schema[key]) return key;

  // Check aliases
  for (const [schemaKey, config] of Object.entries(schema)) {
    if (config.alias === key) return schemaKey;
  }

  return undefined;
}

function findSchemaKeyByAlias(alias: string, schema: Record<string, ArgSchema>): string | undefined {
  for (const [key, config] of Object.entries(schema)) {
    if (config.alias === alias) return key;
  }
  return undefined;
}

function parseValue(value: string, type: string): any {
  switch (type) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${value}`);
      }
      return num;
    case 'array':
      return value.split(',').map(v => v.trim());
    case 'boolean':
      return value.toLowerCase() === 'true' || value === '1';
    case 'string':
    default:
      return value;
  }
}
