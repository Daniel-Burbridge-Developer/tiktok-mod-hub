/// <reference types="node" />
// apps/worker/src/index.ts
import { db } from "../../../packages/db-schema"; // Adjust this path!
import { jobControl, events } from "../../../packages/db-schema/schema"; // Import schema definitions
import { eq } from "drizzle-orm";
import { initializeAllStreamers, connections } from "./tiktok-service";

let isJobRunning = false;

async function startTikTokMonitoring() {
  if (isJobRunning) {
    console.log("Worker: TikTok monitoring is already running.");
    return;
  }
  isJobRunning = true;
  console.log("Worker: Starting TikTok live monitoring...");

  try {
    await initializeAllStreamers();
  } catch (err: any) {
    console.error("Worker: Error starting TikTok monitoring:", err.message);
    isJobRunning = false;
  }
}

function stopTikTokMonitoring() {
  if (!isJobRunning) {
    console.log("Worker: TikTok monitoring is already stopped.");
    return;
  }
  isJobRunning = false;

  // Disconnect all TikTok connections
  for (const [username, connection] of Object.entries(connections)) {
    console.log(`Worker: Disconnecting from @${username}...`);
    if (connection.isConnected) {
      connection.disconnect();
    }
  }

  console.log("Worker: TikTok monitoring stopped.");
}

async function pollJobControl() {
  // The db object is already initialized from packages/db-schema
  setInterval(async () => {
    try {
      const rows = await db
        .select()
        .from(jobControl)
        .where(eq(jobControl.id, 1))
        .limit(1);
      const status = rows[0]?.status;

      if (status === "started" && !isJobRunning) {
        startTikTokMonitoring();
      } else if (status === "stopped" && isJobRunning) {
        stopTikTokMonitoring();
      }
    } catch (err: any) {
      console.error(
        "Worker: Error polling job control with Drizzle:",
        err.message
      );
    }
  }, 2000); // Poll every 2 seconds
}

// Start the polling mechanism when the worker process begins
pollJobControl();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Worker: SIGINT received, stopping TikTok monitoring...");
  stopTikTokMonitoring();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("Worker: SIGTERM received, stopping TikTok monitoring...");
  stopTikTokMonitoring();
  process.exit(0);
});
