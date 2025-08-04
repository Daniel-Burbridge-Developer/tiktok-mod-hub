/// <reference types="node" />
// apps/worker/src/index.ts
import { db } from "../../../packages/db-schema"; // Adjust this path!
import { jobControl } from "../../../packages/db-schema/schema"; // Import schema definitions
import { eq } from "drizzle-orm";
import {
  initializeAllStreamers,
  stopAllMonitoring,
  connections,
} from "./tiktok-service";

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

async function stopTikTokMonitoring() {
  if (!isJobRunning) {
    console.log("Worker: TikTok monitoring is already stopped.");
    return;
  }
  isJobRunning = false;

  try {
    await stopAllMonitoring();
    console.log("Worker: TikTok monitoring stopped.");
  } catch (err: any) {
    console.error("Worker: Error stopping TikTok monitoring:", err.message);
  }
}

async function pollJobControl() {
  // The db object is already initialized from packages/db-schema
  setInterval(async () => {
    try {
      const rows = await db.withRetry(
        () => db.select().from(jobControl).where(eq(jobControl.id, 1)).limit(1),
        "poll job control"
      );
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
