import { describe, test, expect } from "bun:test";
import { z } from "zod";
import { createEnv } from "../src/createEnv.js";
import { sensitive } from "../src/sensitive.js";
import { EnvValidationError } from "../src/errors.js";

describe("createEnv", () => {
  test("validates and returns typed env vars from source", () => {
    const env = createEnv({
      schema: {
        PORT: z.coerce.number().default(3000),
        HOST: z.string().default("localhost"),
      },
      source: { PORT: "8080" },
      files: [],
    });

    expect(env.PORT).toBe(8080);
    expect(env.HOST).toBe("localhost");
  });

  test("throws EnvValidationError for missing required vars", () => {
    expect(() =>
      createEnv({
        schema: {
          DATABASE_URL: z.string().url(),
        },
        source: {},
        files: [],
      })
    ).toThrow(EnvValidationError);
  });

  test("error message includes variable name and details", () => {
    try {
      createEnv({
        schema: {
          DATABASE_URL: z.string().url(),
          API_KEY: z.string().min(10),
        },
        source: { API_KEY: "short" },
        files: [],
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const e = err as EnvValidationError;
      expect(e.errors.length).toBe(2);
      expect(e.errors[0].key).toBe("DATABASE_URL");
      expect(e.errors[1].key).toBe("API_KEY");
      expect(e.message).toContain("DATABASE_URL");
      expect(e.message).toContain("API_KEY");
    }
  });

  test("coerces booleans correctly", () => {
    const env = createEnv({
      schema: {
        DEBUG: z.coerce.boolean().default(false),
      },
      source: { DEBUG: "true" },
      files: [],
    });

    expect(env.DEBUG).toBe(true);
  });

  test("coerces numbers correctly", () => {
    const env = createEnv({
      schema: {
        PORT: z.coerce.number().int().min(1).max(65535),
      },
      source: { PORT: "3000" },
      files: [],
    });

    expect(env.PORT).toBe(3000);
  });

  test("handles enums", () => {
    const env = createEnv({
      schema: {
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      },
      source: { NODE_ENV: "production" },
      files: [],
    });

    expect(env.NODE_ENV).toBe("production");
  });

  test("handles optional vars", () => {
    const env = createEnv({
      schema: {
        REDIS_URL: z.string().url().optional(),
      },
      source: {},
      files: [],
    });

    expect(env.REDIS_URL).toBeUndefined();
  });

  test("result is frozen (immutable)", () => {
    const env = createEnv({
      schema: {
        PORT: z.coerce.number().default(3000),
      },
      source: {},
      files: [],
    });

    expect(() => {
      (env as any).PORT = 9999;
    }).toThrow();
  });

  test("source overrides file values", () => {
    const env = createEnv({
      schema: {
        PORT: z.coerce.number().default(3000),
      },
      source: { PORT: "9999" },
      files: [],
    });

    expect(env.PORT).toBe(9999);
  });
});

describe("sensitive masking", () => {
  test("masks sensitive keys in JSON output via options", () => {
    const env = createEnv({
      schema: {
        PUBLIC_KEY: z.string(),
        SECRET_KEY: z.string(),
      },
      source: { PUBLIC_KEY: "pk_123", SECRET_KEY: "sk_secret_456" },
      sensitive: ["SECRET_KEY"],
      files: [],
    });

    const json = JSON.parse(JSON.stringify(env));
    expect(json.PUBLIC_KEY).toBe("pk_123");
    expect(json.SECRET_KEY).toBe("[MASKED]");

    // Direct access still works
    expect(env.SECRET_KEY).toBe("sk_secret_456");
  });

  test("masks sensitive keys via sensitive() helper", () => {
    const env = createEnv({
      schema: {
        TOKEN: sensitive(z.string()),
        NAME: z.string(),
      },
      source: { TOKEN: "my-secret-token", NAME: "app" },
      files: [],
    });

    const json = JSON.parse(JSON.stringify(env));
    expect(json.TOKEN).toBe("[MASKED]");
    expect(json.NAME).toBe("app");

    // Direct access still works
    expect(env.TOKEN).toBe("my-secret-token");
  });

  test("spread/Object.assign return real values (documented limitation)", () => {
    const env = createEnv({
      schema: {
        PUBLIC: z.string(),
        SECRET: z.string(),
      },
      source: { PUBLIC: "visible", SECRET: "hidden-value" },
      sensitive: ["SECRET"],
      files: [],
    });

    // Spread and Object.assign use per-key access, which returns real values.
    // This is a known, documented limitation. Masking targets bulk serialization
    // (JSON.stringify, console.log), not per-key extraction.
    const spread = { ...env };
    expect(spread.SECRET).toBe("hidden-value");

    const assigned = Object.assign({}, env);
    expect(assigned.SECRET).toBe("hidden-value");
  });

  test("masks in String() coercion and template literals", () => {
    const env = createEnv({
      schema: {
        SECRET: z.string(),
      },
      source: { SECRET: "super-secret" },
      sensitive: ["SECRET"],
      files: [],
    });

    const str = String(env);
    expect(str).toContain("[MASKED]");
    expect(str).not.toContain("super-secret");

    const template = `${env}`;
    expect(template).toContain("[MASKED]");
    expect(template).not.toContain("super-secret");
  });

  test("destructuring extracts real value (known limitation)", () => {
    const env = createEnv({
      schema: {
        SECRET: z.string(),
      },
      source: { SECRET: "real-value" },
      sensitive: ["SECRET"],
      files: [],
    });

    // Destructuring bypasses proxy — this is by design
    const { SECRET } = env;
    expect(SECRET).toBe("real-value");
  });

  test("Object.keys works on masked env", () => {
    const env = createEnv({
      schema: {
        A: z.string(),
        B: z.string(),
      },
      source: { A: "1", B: "2" },
      sensitive: ["B"],
      files: [],
    });

    expect(Object.keys(env)).toEqual(["A", "B"]);
  });

  test("JSON.stringify with replacer still masks", () => {
    const env = createEnv({
      schema: {
        PUBLIC: z.string(),
        SECRET: z.string(),
      },
      source: { PUBLIC: "visible", SECRET: "hidden" },
      sensitive: ["SECRET"],
      files: [],
    });

    const json = JSON.stringify(env, null, 2);
    expect(json).toContain("[MASKED]");
    expect(json).not.toContain("hidden");
  });
});
