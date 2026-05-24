import type { ZodType } from "zod";
import type { SensitiveSchema } from "./createEnv.js";

/**
 * Mark a Zod schema as sensitive. Values will be masked in logs and JSON output.
 *
 * Usage:
 *   sensitive(z.string().min(32))
 */
export function sensitive<T extends ZodType<any>>(schema: T): T & SensitiveSchema {
  (schema as T & SensitiveSchema)._sensitive = true;
  return schema as T & SensitiveSchema;
}
