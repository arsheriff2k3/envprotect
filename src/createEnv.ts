import { z, type ZodType, type ZodDefault, type ZodOptional } from "zod";
import { loadEnvFiles } from "./loader.js";
import { EnvValidationError, zodIssueToEnvError, type EnvError } from "./errors.js";
import { createMaskedEnv } from "./masking.js";

export interface SensitiveSchema {
  _sensitive?: boolean;
}

export type EnvSchema = Record<string, ZodType<any> & Partial<SensitiveSchema>>;

export interface CreateEnvOptions<T extends EnvSchema> {
  /** Zod schema for each environment variable */
  schema: T;
  /** .env files to load (in order, later overrides earlier). Default: ['.env', '.env.local'] */
  files?: string[];
  /** Working directory for resolving .env files. Default: process.cwd() */
  cwd?: string;
  /** Override source of environment variables (default: process.env) */
  source?: Record<string, string | undefined>;
  /** Keys to mask in JSON/log output */
  sensitive?: (keyof T)[];
}

type InferSchema<T extends EnvSchema> = {
  [K in keyof T]: z.infer<T[K]>;
};

/**
 * Load, validate, and return a fully typed environment object.
 * Fails fast at startup with clear error messages if any variables are invalid or missing.
 */
export function createEnv<T extends EnvSchema>(
  options: CreateEnvOptions<T>
): Readonly<InferSchema<T>> {
  const {
    schema,
    files = [".env", ".env.local"],
    cwd,
    source,
    sensitive = [],
  } = options;

  // 1. Load .env files
  const fileVars = loadEnvFiles(files, cwd);

  // 2. Merge: .env files < process.env (process.env wins)
  const envSource = source ?? (process.env as Record<string, string | undefined>);
  const merged: Record<string, string | undefined> = { ...fileVars };
  for (const key of Object.keys(schema)) {
    if (envSource[key] !== undefined) {
      merged[key] = envSource[key];
    }
  }

  // 3. Validate each variable
  const errors: EnvError[] = [];
  const result: Record<string, unknown> = {};

  for (const [key, zodSchema] of Object.entries(schema)) {
    const raw = merged[key];
    const parseResult = zodSchema.safeParse(raw);

    if (parseResult.success) {
      result[key] = parseResult.data;
    } else {
      for (const issue of parseResult.error.issues) {
        errors.push(zodIssueToEnvError(key, issue));
      }
    }
  }

  // 4. Throw aggregated errors
  if (errors.length > 0) {
    throw new EnvValidationError(errors);
  }

  // 5. Build sensitive keys set
  const sensitiveKeys = new Set<string>();
  for (const key of sensitive) {
    sensitiveKeys.add(key as string);
  }
  // Also check for _sensitive flag on schema
  for (const [key, zodSchema] of Object.entries(schema)) {
    if ((zodSchema as SensitiveSchema)._sensitive) {
      sensitiveKeys.add(key);
    }
  }

  // 6. Apply masking proxy and freeze
  const env = createMaskedEnv(result as InferSchema<T>, sensitiveKeys);
  return Object.freeze(env);
}
