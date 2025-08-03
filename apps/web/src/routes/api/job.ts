// apps/Tiktok-mod-hub/src/routes/api/job.ts

import { createFileRoute } from "@tanstack/react-router";

// Define the route for /api/job
export const Route = createFileRoute("/api/job")({
  // This loader handles all HTTP methods
  loader: async (context: any) => {
    // Access the request from the context
    const request = context.request;
    const method = request?.method || "GET";

    switch (method) {
      case "GET":
        // This could fetch current job status from DB or worker
        return { status: "Job status: Unknown" };

      case "POST":
        console.log("Received request to start background job!");
        // Here you'd send a message to your worker to start
        // e.g., db.insert(startJobCommand);
        return { message: "Attempting to start background job..." };

      case "DELETE":
        console.log("Received request to stop background job!");
        // Here you'd send a message to your worker to stop
        // e.g., db.insert(stopJobCommand);
        return { message: "Attempting to stop background job..." };

      default:
        // Handle other methods or return an error
        throw new Error(`Method ${method} not allowed for /api/job`);
    }
  },
});
