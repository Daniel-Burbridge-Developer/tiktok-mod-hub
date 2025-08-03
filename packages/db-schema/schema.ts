// packages/db-schema/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  message: text("message").notNull(),
});

export const jobControl = sqliteTable("job_control", {
  id: integer("id").primaryKey().default(1), // Default to 1 for a single row
  status: text("status", { enum: ["started", "stopped"] })
    .notNull()
    .default("stopped"),
});
