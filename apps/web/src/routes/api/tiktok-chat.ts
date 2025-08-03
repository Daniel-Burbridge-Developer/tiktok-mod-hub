// apps/web/src/routes/api/tiktok-chat.ts

import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { db } from "../../../../../packages/db-schema";
import {
  tiktokChatEvents,
  tiktokGiftEvents,
  tiktokLikeEvents,
  tiktokShareEvents,
  tiktokMemberEvents,
  tiktokStreamInfo,
} from "../../../../../packages/db-schema/schema";
import { desc, eq } from "drizzle-orm";

export const ServerRoute = createServerFileRoute("/api/tiktok-chat").methods({
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
      const streamer = url.searchParams.get("streamer");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const eventType = url.searchParams.get("type") || "chat";

      let events: any[] = [];
      let streamInfo: any[] = [];

      // Get stream info for all streamers
      streamInfo = await db
        .select()
        .from(tiktokStreamInfo)
        .orderBy(desc(tiktokStreamInfo.lastUpdated));

      // Get events based on type and streamer filter
      switch (eventType) {
        case "chat":
          if (streamer) {
            events = await db
              .select()
              .from(tiktokChatEvents)
              .where(eq(tiktokChatEvents.streamerUsername, streamer))
              .orderBy(desc(tiktokChatEvents.timestamp))
              .limit(limit);
          } else {
            events = await db
              .select()
              .from(tiktokChatEvents)
              .orderBy(desc(tiktokChatEvents.timestamp))
              .limit(limit);
          }
          break;
        case "gifts":
          if (streamer) {
            events = await db
              .select()
              .from(tiktokGiftEvents)
              .where(eq(tiktokGiftEvents.streamerUsername, streamer))
              .orderBy(desc(tiktokGiftEvents.timestamp))
              .limit(limit);
          } else {
            events = await db
              .select()
              .from(tiktokGiftEvents)
              .orderBy(desc(tiktokGiftEvents.timestamp))
              .limit(limit);
          }
          break;
        case "likes":
          if (streamer) {
            events = await db
              .select()
              .from(tiktokLikeEvents)
              .where(eq(tiktokLikeEvents.streamerUsername, streamer))
              .orderBy(desc(tiktokLikeEvents.timestamp))
              .limit(limit);
          } else {
            events = await db
              .select()
              .from(tiktokLikeEvents)
              .orderBy(desc(tiktokLikeEvents.timestamp))
              .limit(limit);
          }
          break;
        case "shares":
          if (streamer) {
            events = await db
              .select()
              .from(tiktokShareEvents)
              .where(eq(tiktokShareEvents.streamerUsername, streamer))
              .orderBy(desc(tiktokShareEvents.timestamp))
              .limit(limit);
          } else {
            events = await db
              .select()
              .from(tiktokShareEvents)
              .orderBy(desc(tiktokShareEvents.timestamp))
              .limit(limit);
          }
          break;
        case "members":
          if (streamer) {
            events = await db
              .select()
              .from(tiktokMemberEvents)
              .where(eq(tiktokMemberEvents.streamerUsername, streamer))
              .orderBy(desc(tiktokMemberEvents.timestamp))
              .limit(limit);
          } else {
            events = await db
              .select()
              .from(tiktokMemberEvents)
              .orderBy(desc(tiktokMemberEvents.timestamp))
              .limit(limit);
          }
          break;
        default:
          // Return all event types
          const [
            chatEvents,
            giftEvents,
            likeEvents,
            shareEvents,
            memberEvents,
          ] = await Promise.all([
            db
              .select()
              .from(tiktokChatEvents)
              .orderBy(desc(tiktokChatEvents.timestamp))
              .limit(limit),
            db
              .select()
              .from(tiktokGiftEvents)
              .orderBy(desc(tiktokGiftEvents.timestamp))
              .limit(limit),
            db
              .select()
              .from(tiktokLikeEvents)
              .orderBy(desc(tiktokLikeEvents.timestamp))
              .limit(limit),
            db
              .select()
              .from(tiktokShareEvents)
              .orderBy(desc(tiktokShareEvents.timestamp))
              .limit(limit),
            db
              .select()
              .from(tiktokMemberEvents)
              .orderBy(desc(tiktokMemberEvents.timestamp))
              .limit(limit),
          ]);

          events = [
            ...chatEvents.map((e) => ({ ...e, type: "chat" })),
            ...giftEvents.map((e) => ({ ...e, type: "gift" })),
            ...likeEvents.map((e) => ({ ...e, type: "like" })),
            ...shareEvents.map((e) => ({ ...e, type: "share" })),
            ...memberEvents.map((e) => ({ ...e, type: "member" })),
          ]
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            )
            .slice(0, limit);
      }

      return json({
        events,
        streamInfo,
        totalEvents: events.length,
        eventType,
        streamer: streamer || "all",
      });
    } catch (error) {
      console.error("Error fetching TikTok chat data:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch chat data" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
});
