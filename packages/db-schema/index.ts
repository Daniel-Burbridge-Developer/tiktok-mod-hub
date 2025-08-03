// packages/db-schema/index.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Declare window for TypeScript
declare const window: any;

// This path will be set by Docker Compose, or fallback for local dev
const DATABASE_FILE_NAME = "events.sqlite";

// Only initialize database on server side
let db: any = null;
let DB_FULL_PATH: string = "";

if (typeof window === "undefined") {
  // Server-side only
  const DB_DIR =
    process.env.DATABASE_PATH_DIR ||
    (() => {
      // Try to find the project root by looking for pnpm-workspace.yaml
      let currentDir = process.cwd();
      while (currentDir !== path.dirname(currentDir)) {
        if (fs.existsSync(path.join(currentDir, "pnpm-workspace.yaml"))) {
          return path.join(currentDir, "db");
        }
        currentDir = path.dirname(currentDir);
      }
      // Fallback to current directory if we can't find the workspace root
      return path.resolve(process.cwd(), "db");
    })();
  DB_FULL_PATH = path.join(DB_DIR, DATABASE_FILE_NAME);

  // Ensure the directory exists for local development
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const client = createClient({
    url: `file:${DB_FULL_PATH}`, // Connects to a local SQLite file
  });

  db = drizzle(client, { schema });

  console.log("Drizzle DB client initialized for:", DB_FULL_PATH);
} else {
  // Client-side - provide a mock db that throws errors
  db = {
    insert: () => {
      throw new Error("Database operations not available on client side");
    },
    select: () => {
      throw new Error("Database operations not available on client side");
    },
    update: () => {
      throw new Error("Database operations not available on client side");
    },
    delete: () => {
      throw new Error("Database operations not available on client side");
    },
  };
}

export { db };

// Optional: Auto-migrate schema on connect for dev/simple setups
// In production, you'd run migrations separately (e.g., using drizzle-kit CLI)
async function migrateSchema() {
  try {
    // You would typically use drizzle-kit migrations here.
    // For a simple local setup, you could manually create tables
    // based on the schema if they don't exist.
    // For production, you'd use `drizzle-kit generate` and `drizzle-kit push` or `migrate`.
    // For now, let's keep it simple and assume they exist or you'll run `drizzle-kit push`
    // before starting the app.
    // Or for initial dev, you could do raw SQL for table creation as we did before,
    // but let's stick to Drizzle for interaction.
  } catch (error) {
    console.error("Error during Drizzle schema migration:", error);
  }
}
migrateSchema();
