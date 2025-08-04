// add-usernames.ts
import { createClient } from "@libsql/client";
import path from "path";

async function addUsernames() {
  try {
    console.log("Adding missing usernames...");
    
    const DB_PATH = path.resolve(process.cwd(), "db", "events.sqlite");
    const client = createClient({
      url: `file:${DB_PATH}`,
    });

    console.log("Database path:", DB_PATH);

    // Add the missing usernames
    const usernames = [
      "rhiannonthatcherdesigns",
      "alhubbo", 
      "dandbcreative"
    ];

    for (const username of usernames) {
      try {
        await client.execute(`
          INSERT OR IGNORE INTO tracked_usernames (username, added_at, is_active) 
          VALUES (?, ?, 1)
        `, [username, new Date().toISOString()]);
        console.log(`Added username: ${username}`);
      } catch (error) {
        console.log(`Username ${username} already exists or error:`, error);
      }
    }

    // Check final result
    const allUsernames = await client.execute("SELECT username, is_active FROM tracked_usernames");
    console.log("All tracked usernames:", allUsernames.rows);

  } catch (error) {
    console.error("Failed to add usernames:", error);
  }
}

addUsernames().then(() => {
  console.log("Username addition completed");
  process.exit(0);
}); 