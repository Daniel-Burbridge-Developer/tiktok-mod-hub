// apps/Tiktok-mod-hub/src/routes/api/job.ts

import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { db } from "../../../../../packages/db-schema"; // Adjust this path!
import { jobControl, events } from "../../../../../packages/db-schema/schema"; // Import schema definitions
import { eq } from "drizzle-orm"; // For queries

export const ServerRoute = createServerFileRoute("/api/job").methods({
  GET: async ({ request }) => {
    if (!db) {
      console.error("Database client not initialized in API route.");
      return new Response(
        JSON.stringify({ status: "Error: Database not ready" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const currentJobStatus = await db
        .select()
        .from(jobControl)
        .where(eq(jobControl.id, 1))
        .limit(1);

      return json({
        status: `Current job status: ${currentJobStatus[0] ? currentJobStatus[0].status : "unknown"}`,
      });
    } catch (error) {
      console.error("Error getting job status:", error);
      return new Response(
        JSON.stringify({ error: "Failed to get job status" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },

  POST: async ({ request }) => {
    if (!db) {
      console.error("Database client not initialized in API route.");
      return new Response(JSON.stringify({ error: "Database not ready" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      console.log("Received request to start background job!");
      await db
        .insert(jobControl)
        .values({ id: 1, status: "started" })
        .onConflictDoUpdate({
          target: jobControl.id,
          set: { status: "started" },
        });
      console.log("Set job_control status to 'started'");
      return json({ message: "Attempting to start background job..." });
    } catch (error) {
      console.error("Error starting job:", error);
      return new Response(JSON.stringify({ error: "Failed to start job" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  DELETE: async ({ request }) => {
    if (!db) {
      console.error("Database client not initialized in API route.");
      return new Response(JSON.stringify({ error: "Database not ready" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      console.log("Received request to stop background job!");
      await db
        .insert(jobControl)
        .values({ id: 1, status: "stopped" })
        .onConflictDoUpdate({
          target: jobControl.id,
          set: { status: "stopped" },
        });
      console.log("Set job_control status to 'stopped'");
      return json({ message: "Attempting to stop background job..." });
    } catch (error) {
      console.error("Error stopping job:", error);
      return new Response(JSON.stringify({ error: "Failed to stop job" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
