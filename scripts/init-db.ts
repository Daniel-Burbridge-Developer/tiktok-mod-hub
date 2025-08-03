#!/usr/bin/env tsx

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../packages/db-schema/schema";
import path from "path";
import fs from "fs";

const DATABASE_FILE_NAME = "events.sqlite";
const DB_DIR = path.resolve(process.cwd(), "db");
const DB_FULL_PATH = path.join(DB_DIR, DATABASE_FILE_NAME);

async function initDatabase() {
  console.log("Initializing database...");

  // Ensure the directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log("Created db directory");
  }

  // Create database client
  const client = createClient({
    url: `file:${DB_FULL_PATH}`,
  });

  const db = drizzle(client, { schema });

  try {
    // Initialize job_control table with default stopped status
    await db
      .insert(schema.jobControl)
      .values({
        id: 1,
        status: "stopped",
      })
      .onConflictDoNothing();

    console.log("✅ Database initialized successfully!");
    console.log(`📁 Database location: ${DB_FULL_PATH}`);
    console.log("🚀 You can now run: pnpm dev");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    process.exit(1);
  }
}

initDatabase();
