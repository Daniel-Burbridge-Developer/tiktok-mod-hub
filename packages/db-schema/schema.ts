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

// New tables for enhanced features
export const trackedUsernames = sqliteTable("tracked_usernames", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  addedAt: text("added_at").notNull(),
  lastSeen: text("last_seen"),
  totalStreams: integer("total_streams").notNull().default(0),
  totalDuration: integer("total_duration").notNull().default(0), // in seconds
  notes: text("notes"),
});

export const streamSessions = sqliteTable("stream_sessions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull().unique(),
  streamerUsername: text("streamer_username").notNull(),
  roomId: text("room_id").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  duration: integer("duration"), // in seconds
  totalViews: integer("total_views"),
  peakViewers: integer("peak_viewers"),
  totalLikes: integer("total_likes").notNull().default(0),
  totalGifts: integer("total_gifts").notNull().default(0),
  totalShares: integer("total_shares").notNull().default(0),
  totalComments: integer("total_comments").notNull().default(0),
  totalMembers: integer("total_members").notNull().default(0),
  streamTitle: text("stream_title"),
  streamDescription: text("stream_description"),
  isCompleted: integer("is_completed", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const streamHighlights = sqliteTable("stream_highlights", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  streamerUsername: text("streamer_username").notNull(),
  highlightType: text("highlight_type", {
    enum: ["gift", "like", "share", "member", "chat"],
  }).notNull(),
  timestamp: text("timestamp").notNull(),
  description: text("description").notNull(),
  data: text("data"), // JSON string for additional data
});

export const userStats = sqliteTable("user_stats", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userNickname: text("user_nickname").notNull(),
  streamerUsername: text("streamer_username").notNull(),
  totalGifts: integer("total_gifts").notNull().default(0),
  totalLikes: integer("total_likes").notNull().default(0),
  totalShares: integer("total_shares").notNull().default(0),
  totalComments: integer("total_comments").notNull().default(0),
  totalMemberships: integer("total_memberships").notNull().default(0),
  firstSeen: text("first_seen").notNull(),
  lastSeen: text("last_seen").notNull(),
  isTopFan: integer("is_top_fan", { mode: "boolean" }).notNull().default(false),
});
