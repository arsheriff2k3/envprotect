# envProtect

Type-safe environment variable validation with Zod.

Stop crashing at 2 AM. Load, validate, and protect your env vars with full TypeScript inference, secrets masking, and `.env.example` generation.

[![npm version](https://img.shields.io/npm/v/envprotect.svg)](https://www.npmjs.com/package/envprotect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Website](https://env-protect-web.vercel.app/) | [GitHub](https://github.com/arsheriff2k3/envprotect) | [npm](https://www.npmjs.com/package/envprotect)

## Why envProtect?

| Problem | Without envProtect | With envProtect |
|---------|-------------------|-----------------|
| Missing env var | Crashes at 2 AM deep in a code path | Fails at startup with clear message |
| `process.env.PORT` | `string \| undefined` | `number` (auto-coerced) |
| `process.env.DEBUG = "false"` | Truthy! `if (DEBUG)` is always true | `boolean` - works correctly |
| `console.log(env)` | Leaks `DATABASE_URL` with credentials | Shows `[MASKED]` for sensitive vars |
| `.env.example` | Manually maintained, always outdated | Auto-generated from your schema |
| Type safety | Zero - typos compile fine | Full inference - IDE autocomplete works |

## Install

```bash
npm install envprotect zod
# or
bun add envprotect zod
# or
pnpm add envprotect zod
```

## Quick Start

```typescript
import { createEnv, sensitive } from 'envprotect';
import { z } from 'zod';

const env = createEnv({
  schema: {
    DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_SECRET: sensitive(z.string().min(32)),
    DEBUG: z.coerce.boolean().default(false),
    REDIS_URL: z.string().url().optional(),
  },
});

// Fully typed - IDE autocomplete works
env.PORT       // number (not string!)
env.DEBUG      // boolean (not "false"!)
env.API_SECRET // string (masked in JSON.stringify)
env.REDIS_URL  // string | undefined
```

## Features

### Load + Validate in One Call
Loads `.env` files and validates against your Zod schema. No more gluing `dotenv` + `zod` manually.

```typescript
// Loads .env and .env.local automatically
const env = createEnv({
  schema: {
    PORT: z.coerce.number().default(3000),
  },
});

// Or bring your own source
const env = createEnv({
  schema: { PORT: z.coerce.number() },
  source: { PORT: '8080' },  // skip .env files
  files: [],
});
```

### Fail Fast with Clear Errors
Not "validation failed". Exactly which variable, what was expected, and what was received.

```
envprotect: 2 environment variables failed validation:

  DATABASE_URL: Required
    Expected: string
    Received: undefined

  PORT: Expected number, received nan
    Expected: number
    Received: "abc"
```

### Secrets Masking
Mark variables as sensitive. They work normally in code but show `[MASKED]` in serialization.

```typescript
import { createEnv, sensitive } from 'envprotect';

const env = createEnv({
  schema: {
    PUBLIC_KEY: z.string(),
    SECRET_KEY: sensitive(z.string()),
  },
  source: { PUBLIC_KEY: 'pk_123', SECRET_KEY: 'sk_secret_456' },
});

// Serialization is masked
JSON.stringify(env)  // {"PUBLIC_KEY":"pk_123","SECRET_KEY":"[MASKED]"}
console.log(env)     // { PUBLIC_KEY: 'pk_123', SECRET_KEY: '[MASKED]' }

// Direct access still works
env.SECRET_KEY       // "sk_secret_456"
```

You can also use the `sensitive` option instead of the helper:

```typescript
const env = createEnv({
  schema: {
    DB_URL: z.string().url(),
    API_KEY: z.string(),
  },
  sensitive: ['DB_URL', 'API_KEY'],
});
```

#### Masking Behavior

| Serialization Path | Masked? | How |
|--------------------|---------|-----|
| `JSON.stringify(env)` | Yes | `toJSON()` proxy trap |
| `console.log(env)` | Yes | `nodejs.util.inspect.custom` |
| `util.inspect(env)` | Yes | `nodejs.util.inspect.custom` |
| `String(env)` / `` `${env}` `` | Yes | `Symbol.toPrimitive` |
| `env.SECRET` (direct access) | No | By design |
| `const { SECRET } = env` (destructuring) | No | Known limitation |
| `{ ...env }` (spread) | No | Known limitation |

> Masking prevents accidental bulk serialization (logging, error reporters). It is not access control.

### TypeScript Inference
Full type inference from your schema. No manual type definitions needed.

```typescript
const env = createEnv({
  schema: {
    PORT: z.coerce.number().default(3000),
    DEBUG: z.coerce.boolean().default(false),
    NODE_ENV: z.enum(['development', 'production', 'test']),
    REDIS_URL: z.string().url().optional(),
  },
});

env.PORT      // number
env.DEBUG     // boolean
env.NODE_ENV  // 'development' | 'production' | 'test'
env.REDIS_URL // string | undefined
env.TYPO      // TypeScript error
```

### Immutable Output
The returned env object is frozen. No accidental mutations.

```typescript
env.PORT = 9999; // TypeError: Cannot assign to read only property
```

### `.env.example` Generation
Auto-generate documentation from your schema.

```bash
npx envprotect generate --schema ./src/env.ts --output .env.example
```

Output:
```bash
# Environment Variables
# Generated by envprotect

# (required) string PostgreSQL connection string
DATABASE_URL=

# (optional, default: 3000) number
PORT=3000

# (optional, default: development) development | production | test
NODE_ENV=development

# (required) sensitive string
API_SECRET=

# (optional, default: false) boolean
DEBUG=false
```

### .env File Loading
Loads multiple `.env` files with override chain. `process.env` always takes precedence.

```typescript
const env = createEnv({
  schema: { ... },
  files: ['.env', '.env.local', '.env.production'],  // later files override earlier
});
```

Works with Node.js `--env-file` flag too — just skip file loading:

```typescript
const env = createEnv({
  schema: { ... },
  files: [],  // vars already in process.env via --env-file
});
```

## API Reference

### `createEnv(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schema` | `Record<string, ZodType>` | required | Zod schema for each env var |
| `files` | `string[]` | `['.env', '.env.local']` | `.env` files to load (in order) |
| `source` | `Record<string, string \| undefined>` | `process.env` | Override env source |
| `sensitive` | `(keyof schema)[]` | `[]` | Keys to mask in serialization |
| `cwd` | `string` | `process.cwd()` | Working directory for `.env` files |

Returns a `Readonly<T>` object with full type inference from your schema.

### `sensitive(schema)`

Wraps a Zod schema to mark it as sensitive. Values are masked in `JSON.stringify`, `console.log`, and `util.inspect`.

```typescript
import { sensitive } from 'envprotect';
API_SECRET: sensitive(z.string().min(32))
```

### `generateEnvExample(schema, sensitiveKeys?)`

Generates `.env.example` content string from a schema object.

```typescript
import { generateEnvExample } from 'envprotect';
const content = generateEnvExample(schema, ['API_SECRET']);
writeFileSync('.env.example', content);
```

### `EnvValidationError`

Thrown when validation fails. Contains an `errors` array with details.

```typescript
import { EnvValidationError } from 'envprotect';

try {
  createEnv({ schema, files: [] });
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.log(err.errors);
    // [{ key: 'DATABASE_URL', message: 'Required', expected: 'string', received: 'undefined' }]
  }
}
```

### `parseEnvFile(content)`

Parse a `.env` file string into key-value pairs. Handles quotes, comments, and inline comments.

### `loadEnvFiles(files, cwd?)`

Load and merge multiple `.env` files. Returns a `Record<string, string>`.

## Compatibility

| Runtime | Supported |
|---------|-----------|
| Node.js 18+ | Yes |
| Bun | Yes |
| Deno | Yes |
| Edge runtimes (Cloudflare Workers, Vercel Edge) | Yes |
| ESM | Yes |
| CommonJS | No (ESM-only) |

## Benchmarks

Measured on Apple M-series, Bun 1.3.10.

| Metric | Value |
|--------|-------|
| Validation speed | 3.0 us/call (10K iterations, 4 vars) |
| Bundle size | 12 KB unpacked (7.1 KB packed) |
| Source | 470 lines, 7 modules |
| Runtime deps | 0 (Zod is peer) |
| Tests | 33 passing |

## Comparison

| Feature | dotenv | envalid | @t3-oss/env | znv | envprotect |
|---------|--------|---------|-------------|-----|------------|
| Load .env files | Yes | No | No | No | Yes |
| Zod validation | No | No | Yes | Yes | Yes |
| TypeScript inference | No | Partial | Yes | Yes | Yes |
| Fail-fast errors | No | Yes | Yes | Yes | Yes |
| Secrets masking | No | No | No | No | Yes |
| .env.example gen | No | No | No | No | Yes |
| Framework-agnostic | Yes | Yes | No (Next.js) | Yes | Yes |
| Immutable output | No | Yes | Yes | Yes | Yes |
| Zero runtime deps | Yes | No | No | No | Yes |

## Migration from dotenv

```diff
- require('dotenv').config();
- const port = process.env.PORT;
- const debug = process.env.DEBUG;

+ import { createEnv } from 'envprotect';
+ import { z } from 'zod';
+ const { PORT: port, DEBUG: debug } = createEnv({
+   schema: {
+     PORT: z.coerce.number().default(3000),
+     DEBUG: z.coerce.boolean().default(false),
+   },
+ });
```

## License

[MIT](./LICENSE)
