// packages/db-schema/migrate.ts
import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";

async function migrate() {
  try {
    console.log("Starting database migration...");

    // This path will be set by Docker Compose, or fallback for local dev
    const DATABASE_FILE_NAME = "events.sqlite";
    const DB_DIR =
      process.env.DATABASE_PATH_DIR || path.resolve(process.cwd(), "db");
    const DB_FULL_PATH = path.join(DB_DIR, DATABASE_FILE_NAME);

    // Ensure the directory exists for local development
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    const client = createClient({
      url: `file:${DB_FULL_PATH}`,
    });

    console.log("Drizzle DB client initialized for:", DB_FULL_PATH);

    // Create tables using raw SQL
    const tables = [
      // Original tables
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        message TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS job_control (
        id INTEGER PRIMARY KEY DEFAULT 1,
        status TEXT CHECK(status IN ('started', 'stopped')) NOT NULL DEFAULT 'stopped'
      )`,

      // TikTok tables
      `CREATE TABLE IF NOT EXISTS tiktok_chat_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_username TEXT NOT NULL,
        user_nickname TEXT NOT NULL,
        comment TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS tiktok_gift_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_username TEXT NOT NULL,
        user_nickname TEXT NOT NULL,
        gift_id TEXT NOT NULL,
        repeat_count INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS tiktok_like_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_username TEXT NOT NULL,
        user_nickname TEXT NOT NULL,
        like_count INTEGER NOT NULL,
        total_like_count INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS tiktok_share_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_username TEXT NOT NULL,
        user_nickname TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS tiktok_member_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_username TEXT NOT NULL,
        user_nickname TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS tiktok_stream_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_username TEXT NOT NULL,
        room_id TEXT NOT NULL,
        hls_url TEXT,
        create_time TEXT,
        streamer_bio TEXT,
        is_live INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL
      )`,
    ];

    for (const table of tables) {
      await client.execute(table);
      console.log("Created table:", table.split(" ")[2]);
    }

    // Insert default job control record if it doesn't exist
    await client.execute(`
      INSERT OR IGNORE INTO job_control (id, status) VALUES (1, 'stopped')
    `);

    console.log("Database migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate().then(() => {
    console.log("Migration script completed");
    process.exit(0);
  });
}

export { migrate };
