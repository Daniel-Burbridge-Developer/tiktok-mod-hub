/// <reference types="node" />
// apps/worker/src/index.ts
import { db } from "../../../packages/db-schema"; // Adjust this path!
import { jobControl, events } from "../../../packages/db-schema/schema"; // Import schema definitions
import { eq } from "drizzle-orm";

let isJobRunning = false;
let logInterval: NodeJS.Timeout | null = null;

async function startLoggingJob() {
  if (isJobRunning) {
    console.log("Worker: Job is already running.");
    return;
  }
  isJobRunning = true;
  console.log("Worker: Starting logging job...");
  if (logInterval) clearInterval(logInterval);

  logInterval = setInterval(async () => {
    try {
      const timestamp = new Date().toISOString();
      const message = `Event logged at ${timestamp}`;
      await db.insert(events).values({ timestamp, message });
      console.log("Worker: Logged:", message);
    } catch (err: any) {
      console.error("Worker: Error logging event with Drizzle:", err.message);
    }
  }, 5000); // Log every 5 seconds
}

function stopLoggingJob() {
  if (!isJobRunning) {
    console.log("Worker: Job is already stopped.");
    return;
  }
  isJobRunning = false;
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
  console.log("Worker: Logging job stopped.");
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
        startLoggingJob();
      } else if (status === "stopped" && isJobRunning) {
        stopLoggingJob();
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
  console.log("Worker: SIGINT received, stopping job...");
  stopLoggingJob();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("Worker: SIGTERM received, stopping job...");
  stopLoggingJob();
  process.exit(0);
});
