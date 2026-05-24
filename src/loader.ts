import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Parse a .env file content into key-value pairs.
 * Handles quoted values, comments, empty lines, and multiline values.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Remove inline comments (only for unquoted values)
    if (!trimmed.slice(eqIndex + 1).trim().startsWith('"')) {
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Load environment variables from .env files.
 * Later files override earlier ones. process.env always takes precedence.
 */
export function loadEnvFiles(
  files: string[],
  cwd: string = process.cwd()
): Record<string, string> {
  const loaded: Record<string, string> = {};

  for (const file of files) {
    const filePath = resolve(cwd, file);
    if (!existsSync(filePath)) continue;

    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = parseEnvFile(content);
      Object.assign(loaded, parsed);
    } catch {
      // Skip files that can't be read
    }
  }

  return loaded;
}
