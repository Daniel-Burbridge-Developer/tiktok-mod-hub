// packages/db-schema/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  message: text("message").notNull(),
});

export const jobControl = sqliteTable("job_control", {
  id: integer("id").primaryKey().default(1), // Default to 1 for a single row
  status: text("status", { enum: ["started", "stopped"] })
    .notNull()
    .default("stopped"),
});

// TikTok Live Stream Events
export const tiktokChatEvents = sqliteTable("tiktok_chat_events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  streamerUsername: text("streamer_username").notNull(),
  userNickname: text("user_nickname").notNull(),
  comment: text("comment").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const tiktokGiftEvents = sqliteTable("tiktok_gift_events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  streamerUsername: text("streamer_username").notNull(),
  userNickname: text("user_nickname").notNull(),
  giftId: text("gift_id").notNull(),
  repeatCount: integer("repeat_count").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const tiktokLikeEvents = sqliteTable("tiktok_like_events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  streamerUsername: text("streamer_username").notNull(),
  userNickname: text("user_nickname").notNull(),
  likeCount: integer("like_count").notNull(),
  totalLikeCount: integer("total_like_count").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const tiktokShareEvents = sqliteTable("tiktok_share_events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  streamerUsername: text("streamer_username").notNull(),
  userNickname: text("user_nickname").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const tiktokMemberEvents = sqliteTable("tiktok_member_events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  streamerUsername: text("streamer_username").notNull(),
  userNickname: text("user_nickname").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const tiktokStreamInfo = sqliteTable("tiktok_stream_info", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  streamerUsername: text("streamer_username").notNull(),
  roomId: text("room_id").notNull(),
  hlsUrl: text("hls_url"),
  createTime: text("create_time"),
  streamerBio: text("streamer_bio"),
  isLive: integer("is_live", { mode: "boolean" }).notNull().default(false),
  lastUpdated: text("last_updated").notNull(),
});
