import { describe, test, expect } from "bun:test";
import { parseEnvFile } from "../src/loader.js";

describe("parseEnvFile", () => {
  test("parses simple key=value pairs", () => {
    const result = parseEnvFile("FOO=bar\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("handles double-quoted values", () => {
    const result = parseEnvFile('FOO="hello world"');
    expect(result).toEqual({ FOO: "hello world" });
  });

  test("handles single-quoted values", () => {
    const result = parseEnvFile("FOO='hello world'");
    expect(result).toEqual({ FOO: "hello world" });
  });

  test("skips comments", () => {
    const result = parseEnvFile("# this is a comment\nFOO=bar\n# another comment");
    expect(result).toEqual({ FOO: "bar" });
  });

  test("skips empty lines", () => {
    const result = parseEnvFile("\n\nFOO=bar\n\nBAZ=qux\n\n");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("handles values with = sign", () => {
    const result = parseEnvFile("URL=postgres://user:pass@host/db?ssl=true");
    expect(result).toEqual({ URL: "postgres://user:pass@host/db?ssl=true" });
  });

  test("handles empty values", () => {
    const result = parseEnvFile("FOO=");
    expect(result).toEqual({ FOO: "" });
  });

  test("strips inline comments for unquoted values", () => {
    const result = parseEnvFile("FOO=bar # this is a comment");
    expect(result).toEqual({ FOO: "bar" });
  });

  test("preserves # in quoted values", () => {
    const result = parseEnvFile('FOO="bar # not a comment"');
    expect(result).toEqual({ FOO: "bar # not a comment" });
  });

  test("trims whitespace around keys and values", () => {
    const result = parseEnvFile("  FOO  =  bar  ");
    expect(result).toEqual({ FOO: "bar" });
  });
});
