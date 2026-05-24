const MASKED = "[MASKED]";

/**
 * Build a plain object with sensitive keys masked.
 */
function buildMaskedSnapshot(
  target: Record<string, unknown>,
  sensitiveKeys: Set<string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(target)) {
    result[key] = sensitiveKeys.has(key) ? MASKED : target[key];
  }
  return result;
}

/**
 * Creates a masked env wrapper.
 *
 * Serialization paths return masked values:
 * - JSON.stringify(env)           → toJSON()
 * - console.log(env)              → nodejs.util.inspect.custom
 * - util.inspect(env)             → nodejs.util.inspect.custom
 * - String(env) / `${env}`        → toString() / Symbol.toPrimitive
 *
 * Direct property access (env.SECRET) always returns the real value.
 * This is intentional — masking prevents accidental bulk serialization,
 * not deliberate single-field access.
 *
 * KNOWN LIMITATIONS (documented, by design):
 *   const { SECRET } = env;     → real value (destructuring = direct access)
 *   { ...env }                  → real values (spread = per-key access)
 *   Object.assign({}, env)      → real values (same as spread)
 *   Object.values(env)          → real values (per-key access)
 *
 * These are deliberate access patterns. Masking targets accidental
 * serialization: console.log(env), JSON.stringify(env), error reporters.
 */
export function createMaskedEnv<T extends Record<string, unknown>>(
  values: T,
  sensitiveKeys: Set<string>
): T {
  if (sensitiveKeys.size === 0) return values;

  return new Proxy(values, {
    get(target, prop, receiver) {
      // JSON.stringify calls toJSON()
      if (prop === "toJSON") {
        return () => buildMaskedSnapshot(target, sensitiveKeys);
      }

      // console.log / util.inspect in Node.js
      if (prop === Symbol.for("nodejs.util.inspect.custom")) {
        return (_depth: number, _opts: unknown) =>
          buildMaskedSnapshot(target, sensitiveKeys);
      }

      // String(env) or `${env}`
      if (prop === Symbol.toPrimitive) {
        return (_hint: string) =>
          JSON.stringify(buildMaskedSnapshot(target, sensitiveKeys));
      }
      if (prop === "toString") {
        return () => JSON.stringify(buildMaskedSnapshot(target, sensitiveKeys));
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}
