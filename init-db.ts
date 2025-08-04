// init-db.ts
import { createClient } from "@libsql/client";
import path from "path";

async function initDatabase() {
  try {
    console.log("Initializing database...");
    
    const DB_PATH = path.resolve(process.cwd(), "db", "events.sqlite");
    const client = createClient({
      url: `file:${DB_PATH}`,
    });

    console.log("Database path:", DB_PATH);

    // Create all tables
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

      // New enhanced feature tables
      `CREATE TABLE IF NOT EXISTS tracked_usernames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        added_at TEXT NOT NULL,
        last_seen TEXT,
        total_streams INTEGER NOT NULL DEFAULT 0,
        total_duration INTEGER NOT NULL DEFAULT 0,
        notes TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS stream_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_username TEXT NOT NULL,
        room_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER,
        total_views INTEGER,
        peak_viewers INTEGER,
        total_likes INTEGER NOT NULL DEFAULT 0,
        total_gifts INTEGER NOT NULL DEFAULT 0,
        total_shares INTEGER NOT NULL DEFAULT 0,
        total_comments INTEGER NOT NULL DEFAULT 0,
        total_members INTEGER NOT NULL DEFAULT 0,
        stream_title TEXT,
        stream_description TEXT,
        is_completed INTEGER NOT NULL DEFAULT 0
      )`,

      `CREATE TABLE IF NOT EXISTS stream_highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        streamer_username TEXT NOT NULL,
        highlight_type TEXT CHECK(highlight_type IN ('gift', 'like', 'share', 'member', 'chat')) NOT NULL,
        timestamp TEXT NOT NULL,
        description TEXT NOT NULL,
        data TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS user_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        streamer_username TEXT NOT NULL,
        total_gifts INTEGER NOT NULL DEFAULT 0,
        total_likes INTEGER NOT NULL DEFAULT 0,
        total_shares INTEGER NOT NULL DEFAULT 0,
        total_comments INTEGER NOT NULL DEFAULT 0,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        is_top_fan INTEGER NOT NULL DEFAULT 0
      )`,
    ];

    for (const table of tables) {
      await client.execute(table);
      console.log("Created table:", table.split(" ")[2]);
    }

    // Insert default job control record
    await client.execute(`
      INSERT OR IGNORE INTO job_control (id, status) VALUES (1, 'stopped')
    `);
    console.log("Inserted default job control record");

    // Insert some default tracked usernames
    const defaultUsernames = [
      "rhiannonthatcherdesigns",
      "alhubbo", 
      "prettylushdesigns",
      "dandbcreative"
    ];

    for (const username of defaultUsernames) {
      await client.execute(`
        INSERT OR IGNORE INTO tracked_usernames (username, added_at) 
        VALUES (?, ?)
      `, [username, new Date().toISOString()]);
    }
    console.log("Inserted default tracked usernames");

    console.log("Database initialization completed successfully!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initDatabase().then(() => {
    console.log("Database initialization script completed");
    process.exit(0);
  });
}

export { initDatabase }; 