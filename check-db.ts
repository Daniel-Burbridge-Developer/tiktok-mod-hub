// check-db.ts
import { createClient } from "@libsql/client";
import path from "path";

async function checkDatabase() {
  try {
    console.log("Checking database...");
    
    const DB_PATH = path.resolve(process.cwd(), "db", "events.sqlite");
    const client = createClient({
      url: `file:${DB_PATH}`,
    });

    console.log("Database path:", DB_PATH);

    // Check what tables exist
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log("Existing tables:", tables.rows);

    // Check if job_control table exists and has data
    try {
      const jobControl = await client.execute("SELECT * FROM job_control");
      console.log("Job control data:", jobControl.rows);
    } catch (error) {
      console.log("Job control table doesn't exist or is empty");
    }

    // Check if tracked_usernames table exists and has data
    try {
      const usernames = await client.execute("SELECT * FROM tracked_usernames");
      console.log("Tracked usernames data:", usernames.rows);
    } catch (error) {
      console.log("Tracked usernames table doesn't exist or is empty");
    }

  } catch (error) {
    console.error("Database check failed:", error);
  }
}

checkDatabase().then(() => {
  console.log("Database check completed");
  process.exit(0);
}); 