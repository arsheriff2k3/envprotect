#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const command = args[0];

if (command === "generate") {
  const outputIdx = args.indexOf("--output");
  const output = outputIdx !== -1 ? args[outputIdx + 1] : ".env.example";

  const schemaIdx = args.indexOf("--schema");
  const schemaPath = schemaIdx !== -1 ? args[schemaIdx + 1] : undefined;

  if (!schemaPath) {
    console.log(
      "Usage: envprotect generate --schema ./src/env.ts --output .env.example"
    );
    console.log("");
    console.log(
      "Your schema file must export a `schema` object and optionally a `sensitive` array."
    );
    console.log("");
    console.log("Example schema file (src/env.ts):");
    console.log('  import { z } from "zod";');
    console.log("  export const schema = {");
    console.log("    DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),");
    console.log("    PORT: z.coerce.number().default(3000),");
    console.log("  };");
    console.log('  export const sensitive = ["DATABASE_URL"];');
    process.exit(1);
  }

  const fullSchemaPath = resolve(process.cwd(), schemaPath);

  import(fullSchemaPath)
    .then(async (mod) => {
      const { generateEnvExample } = await import("./generate.js");
      const schema = mod.schema || mod.default?.schema;
      const sensitive = mod.sensitive || mod.default?.sensitive || [];

      if (!schema) {
        console.error(
          `Error: No "schema" export found in ${schemaPath}`
        );
        process.exit(1);
      }

      const content = generateEnvExample(schema, sensitive);
      const outputPath = resolve(process.cwd(), output);
      writeFileSync(outputPath, content, "utf-8");
      console.log(`Generated ${output} with ${Object.keys(schema).length} variables`);
    })
    .catch((err) => {
      console.error(`Error loading schema from ${schemaPath}:`, err.message);
      process.exit(1);
    });
} else {
  console.log("envprotect CLI");
  console.log("");
  console.log("Commands:");
  console.log(
    "  generate  Generate a .env.example file from your schema"
  );
  console.log("");
  console.log("Usage:");
  console.log(
    "  envprotect generate --schema ./src/env.ts --output .env.example"
  );
}
