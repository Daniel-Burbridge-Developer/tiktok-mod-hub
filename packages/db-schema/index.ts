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

// Retry configuration for database operations
const DB_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 100, // milliseconds
  maxDelay: 2000, // milliseconds
};

// Simple semaphore to limit concurrent operations
class DatabaseSemaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(maxConcurrent: number = 3) {
    this.permits = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) next();
    } else {
      this.permits++;
    }
  }
}

const dbSemaphore = new DatabaseSemaphore(3);

// Helper function to add exponential backoff delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to calculate retry delay with exponential backoff
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    DB_RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    DB_RETRY_CONFIG.maxDelay
  );
  return delay + Math.random() * 100; // Add jitter
}

// Wrapper function to retry database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = "database operation"
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= DB_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      await dbSemaphore.acquire();
      try {
        return await operation();
      } finally {
        dbSemaphore.release();
      }
    } catch (error: any) {
      lastError = error;

      // Check if it's a busy error that we should retry
      if (
        error?.code === "SQLITE_BUSY" ||
        error?.cause?.code === "SQLITE_BUSY"
      ) {
        if (attempt < DB_RETRY_CONFIG.maxRetries) {
          const retryDelay = getRetryDelay(attempt);
          console.warn(
            `${operationName} failed with SQLITE_BUSY, retrying in ${retryDelay}ms (attempt ${
              attempt + 1
            }/${DB_RETRY_CONFIG.maxRetries + 1})`
          );
          await delay(retryDelay);
          continue;
        }
      }

      // For non-busy errors or after max retries, throw immediately
      throw error;
    }
  }

  throw lastError;
}

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

  // Create the libsql client
  const client = createClient({
    url: `file:${DB_FULL_PATH}`,
  });

  // --- THIS IS THE CORRECT CHANGE ---
  // Execute the PRAGMA to set WAL mode
  // The 'journal_mode' pragma is only needed once when the db is opened.
  // We'll also set a busy timeout to help with temporary locks.
  client
    .execute("PRAGMA journal_mode = WAL;")
    .then(() => {
      console.log("Database set to WAL mode successfully.");
    })
    .catch((err) => {
      console.error("Failed to set WAL mode:", err);
    });

  client
    .execute("PRAGMA busy_timeout = 5000;")
    .then(() => {
      console.log("Database busy timeout set to 5000ms.");
    })
    .catch((err) => {
      console.error("Failed to set busy timeout:", err);
    });

  const drizzleDb = drizzle(client, { schema });

  // Use the original Drizzle db but add a helper for retry operations
  db = drizzleDb;

  // Add a helper function for operations that need retry logic
  db.withRetry = withRetry;

  console.log("Drizzle DB client initialized for:", DB_FULL_PATH);
} else {
  // ... (client-side mock db code) ...
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
