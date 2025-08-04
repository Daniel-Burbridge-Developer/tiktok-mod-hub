// apps/web/src/routes/api/tracked-usernames.ts

import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { db } from "../../../../../packages/db-schema";
import {
  trackedUsernames,
  streamSessions,
  userStats,
} from "../../../../../packages/db-schema/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export const ServerRoute = createServerFileRoute(
  "/api/tracked-usernames"
).methods({
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
      const url = new URL(request.url);
      const includeStats = url.searchParams.get("stats") === "true";
      const activeOnly = url.searchParams.get("active") === "true";

      let query = db.select().from(trackedUsernames);

      if (activeOnly) {
        query = query.where(eq(trackedUsernames.isActive, true));
      }

      const usernames = await db.withRetry(
        () => query.orderBy(desc(trackedUsernames.lastSeen)),
        "fetch tracked usernames"
      );

      if (includeStats) {
        // Get additional stats for each username
        const enhancedUsernames = await Promise.all(
          usernames.map(async (username) => {
            // Get recent sessions
            const recentSessions = await db.withRetry(
              () =>
                db
                  .select()
                  .from(streamSessions)
                  .where(eq(streamSessions.streamerUsername, username.username))
                  .orderBy(desc(streamSessions.startTime))
                  .limit(5),
              "fetch recent sessions"
            );

            // Get top fans
            const topFans = await db.withRetry(
              () =>
                db
                  .select()
                  .from(userStats)
                  .where(eq(userStats.streamerUsername, username.username))
                  .orderBy(desc(userStats.totalGifts))
                  .limit(10),
              "fetch top fans"
            );

            return {
              ...username,
              recentSessions,
              topFans,
            };
          })
        );

        return json({
          usernames: enhancedUsernames,
          total: enhancedUsernames.length,
        });
      }

      return json({
        usernames,
        total: usernames.length,
      });
    } catch (error) {
      console.error("Error fetching tracked usernames:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch tracked usernames" }),
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
      const body = await request.json();
      const { username, displayName, notes } = body;

      if (!username) {
        return new Response(JSON.stringify({ error: "Username is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Clean username (remove @ if present)
      const cleanUsername = username.replace(/^@/, "");

      const result = await db.withRetry(
        () =>
          db
            .insert(trackedUsernames)
            .values({
              username: cleanUsername,
              displayName: displayName || cleanUsername,
              notes: notes || "",
              addedAt: new Date().toISOString(),
            })
            .returning(),
        "insert tracked username"
      );

      return json({
        message: `Successfully added @${cleanUsername} to tracked usernames`,
        username: result[0],
      });
    } catch (error: any) {
      console.error("Error adding tracked username:", error);

      if (error.message.includes("UNIQUE constraint failed")) {
        return new Response(
          JSON.stringify({ error: "Username is already being tracked" }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to add tracked username" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },

  PUT: async ({ request }) => {
    if (!db) {
      console.error("Database client not initialized in API route.");
      return new Response(JSON.stringify({ error: "Database not ready" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { id, isActive, displayName, notes } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: "ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const updateData: any = {};
      if (typeof isActive === "boolean") updateData.isActive = isActive;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (notes !== undefined) updateData.notes = notes;

      const result = await db
        .update(trackedUsernames)
        .set(updateData)
        .where(eq(trackedUsernames.id, id))
        .returning();

      if (result.length === 0) {
        return new Response(JSON.stringify({ error: "Username not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return json({
        message: "Successfully updated tracked username",
        username: result[0],
      });
    } catch (error) {
      console.error("Error updating tracked username:", error);
      return new Response(
        JSON.stringify({ error: "Failed to update tracked username" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
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
      const url = new URL(request.url);
      const id = url.searchParams.get("id");

      if (!id) {
        return new Response(JSON.stringify({ error: "ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await db
        .delete(trackedUsernames)
        .where(eq(trackedUsernames.id, parseInt(id)))
        .returning();

      if (result.length === 0) {
        return new Response(JSON.stringify({ error: "Username not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return json({
        message: "Successfully removed tracked username",
        username: result[0],
      });
    } catch (error) {
      console.error("Error deleting tracked username:", error);
      return new Response(
        JSON.stringify({ error: "Failed to delete tracked username" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
});
