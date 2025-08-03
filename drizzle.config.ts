// drizzle.config.ts
import type { Config } from "drizzle-kit";
import path from "path";

export default {
  schema: "./packages/db-schema/schema.ts",
  out: "./drizzle", // Directory for generated migrations
  dialect: "sqlite",
  dbCredentials: {
    // This needs to point to the actual file path for local development
    // It will be the same logic as in packages/db-schema/index.ts
    url: `file:${path.resolve(process.cwd(), "db", "events.sqlite")}`,
  },
} satisfies Config;
