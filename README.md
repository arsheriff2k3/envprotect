# envProtect

Type-safe environment variable validation with Zod.

Stop crashing at 2 AM. Load, validate, and protect your env vars with full TypeScript inference, secrets masking, and `.env.example` generation.

## Install

```bash
npm install envprotect zod
```

## Quick Start

```typescript
import { createEnv, sensitive } from 'envprotect';
import { z } from 'zod';

const env = createEnv({
  schema: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_SECRET: sensitive(z.string().min(32)),
    DEBUG: z.coerce.boolean().default(false),
  },
});

env.PORT       // number (not string)
env.DEBUG      // boolean (not "false")
env.API_SECRET // string (masked in JSON.stringify)
```

## Features

- **Load + Validate** - Loads `.env` files and validates with Zod in one call
- **TypeScript Inference** - Full type inference from your schema. IDE autocomplete works.
- **Secrets Masking** - `JSON.stringify(env)` and `console.log(env)` mask sensitive values as `[MASKED]`
- **Fail Fast** - Clear error messages at startup, not crashes at 2 AM
- **`.env.example` Generation** - `npx envprotect generate --schema ./src/env.ts`
- **Zero Runtime Deps** - Zod is a peer dependency, not bundled
- **Framework Agnostic** - Works with Node.js, Bun, Deno, and edge runtimes

## Error Messages

```
envprotect: 2 environment variables failed validation:

  DATABASE_URL: Required
    Expected: string
    Received: undefined

  PORT: Expected number, received nan
    Expected: number
    Received: "abc"
```

## Secrets Masking

```typescript
const env = createEnv({
  schema: {
    PUBLIC_KEY: z.string(),
    SECRET_KEY: sensitive(z.string()),
  },
  source: { PUBLIC_KEY: 'pk_123', SECRET_KEY: 'sk_secret_456' },
});

console.log(JSON.stringify(env));
// {"PUBLIC_KEY":"pk_123","SECRET_KEY":"[MASKED]"}

// Direct access still works
env.SECRET_KEY // "sk_secret_456"
```

### Masking Behavior

| Path | Masked? |
|------|---------|
| `JSON.stringify(env)` | Yes |
| `console.log(env)` | Yes |
| `util.inspect(env)` | Yes |
| `String(env)` | Yes |
| `env.SECRET` (direct access) | No (by design) |
| `const { SECRET } = env` | No (known limitation) |
| `{ ...env }` | No (known limitation) |

## Generate `.env.example`

```bash
npx envprotect generate --schema ./src/env.ts --output .env.example
```

## API

### `createEnv(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schema` | `Record<string, ZodType>` | required | Zod schema for each env var |
| `files` | `string[]` | `['.env', '.env.local']` | `.env` files to load |
| `source` | `Record<string, string>` | `process.env` | Override env source |
| `sensitive` | `string[]` | `[]` | Keys to mask in serialization |
| `cwd` | `string` | `process.cwd()` | Working directory for `.env` files |

### `sensitive(schema)`

Marks a Zod schema as sensitive. Values are masked in `JSON.stringify` and `console.log`.

### `generateEnvExample(schema, sensitiveKeys?)`

Generates `.env.example` content from a schema.

## Benchmarks

| Metric | Value |
|--------|-------|
| Validation speed | 3.0 us/call |
| Bundle size | 12 KB (unpacked) |
| Source | 470 lines, 7 modules |
| Runtime deps | 0 (Zod is peer) |
| Tests | 33 passing |

## License

MIT
