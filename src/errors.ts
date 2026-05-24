import type { ZodIssue } from "zod";

export interface EnvError {
  key: string;
  message: string;
  expected?: string;
  received?: string;
}

export class EnvValidationError extends Error {
  public readonly errors: EnvError[];

  constructor(errors: EnvError[]) {
    const header = `envprotect: ${errors.length} environment variable${errors.length > 1 ? "s" : ""} failed validation:\n`;
    const details = errors
      .map((e) => {
        let msg = `  ${e.key}: ${e.message}`;
        if (e.expected) msg += `\n    Expected: ${e.expected}`;
        if (e.received) msg += `\n    Received: ${e.received}`;
        return msg;
      })
      .join("\n\n");

    super(header + details);
    this.name = "EnvValidationError";
    this.errors = errors;
  }
}

export function zodIssueToEnvError(key: string, issue: ZodIssue): EnvError {
  return {
    key,
    message: issue.message,
    expected: "expected" in issue ? String(issue.expected) : undefined,
    received: "received" in issue ? String(issue.received) : undefined,
  };
}
