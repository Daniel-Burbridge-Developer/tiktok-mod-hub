import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { db } from "../../../packages/db-schema";
import {
  tiktokChatEvents,
  tiktokGiftEvents,
  tiktokLikeEvents,
  tiktokShareEvents,
  tiktokMemberEvents,
  tiktokStreamInfo,
} from "../../../packages/db-schema/schema";
import { eq } from "drizzle-orm";

// Array of TikTok usernames to monitor (replace with usernames that are currently LIVE)
const tiktokUsernames = ["rhiannonthatcherdesigns", "alhubbo", "prettylushdesigns", ""];

// Store connections for each streamer
const connections: { [username: string]: TikTokLiveConnection } = {};

// Function to get current timestamp in local timezone
function getCurrentTimestamp(): string {
  return new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Function to log events to database
async function logToDatabase(
  table: any,
  data: Record<string, any>
): Promise<void> {
  try {
    await db.insert(table).values(data);
  } catch (error) {
    console.error(`Failed to write to database (${table.name}):`, error);
  }
}

// Function to update stream info in database
async function updateStreamInfo(
  username: string,
  roomId: string,
  hlsUrl?: string,
  createTime?: string,
  streamerBio?: string,
  isLive: boolean = true
): Promise<void> {
  try {
    const timestamp = getCurrentTimestamp();

    // Check if stream info already exists for this streamer
    const existing = await db
      .select()
      .from(tiktokStreamInfo)
      .where(eq(tiktokStreamInfo.streamerUsername, username))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(tiktokStreamInfo)
        .set({
          roomId,
          hlsUrl,
          createTime,
          streamerBio,
          isLive,
          lastUpdated: timestamp,
        })
        .where(eq(tiktokStreamInfo.streamerUsername, username));
    } else {
      // Insert new record
      await db.insert(tiktokStreamInfo).values({
        streamerUsername: username,
        roomId,
        hlsUrl,
        createTime,
        streamerBio,
        isLive,
        lastUpdated: timestamp,
      });
    }
  } catch (error) {
    console.error(`Failed to update stream info for @${username}:`, error);
  }
}

// Enhanced event listeners that handle reconnection and database logging
function setupEventListenersWithReconnect(
  username: string,
  connection: TikTokLiveConnection
) {
  // Listen for chat messages (comments)
  connection.on(WebcastEvent.CHAT, (data: any) => {
    const user = data.user?.nickname || "UnknownUser";
    const comment = data.comment;
    const cleanedComment = comment.trim().replace(/\s+/g, " ");
    const timestamp = getCurrentTimestamp();

    console.log(`[${username}] CHAT | ${user}: ${cleanedComment}`);

    logToDatabase(tiktokChatEvents, {
      streamerUsername: username,
      userNickname: user,
      comment: cleanedComment,
      timestamp,
    });
  });

  // Listen for gifts
  connection.on(WebcastEvent.GIFT, (data: any) => {
    const user = data.user?.nickname || "UnknownUser";
    const giftId = data.giftId;
    const repeatCount = data.repeatCount;
    const timestamp = getCurrentTimestamp();

    console.log(
      `[${username}] GIFT | ${user} sent gift ${giftId} (x${repeatCount})`
    );

    logToDatabase(tiktokGiftEvents, {
      streamerUsername: username,
      userNickname: user,
      giftId,
      repeatCount,
      timestamp,
    });
  });

  // Listen for new members joining
  connection.on(WebcastEvent.MEMBER, (data: any) => {
    const user = data.user?.nickname || "UnknownUser";
    const timestamp = getCurrentTimestamp();

    console.log(`[${username}] MEMBER | ${user} joined the stream`);

    logToDatabase(tiktokMemberEvents, {
      streamerUsername: username,
      userNickname: user,
      timestamp,
    });
  });

  // Listen for likes
  connection.on(WebcastEvent.LIKE, (data: any) => {
    const user = data.user?.nickname || "UnknownUser";
    const likeCount = data.likeCount;
    const totalLikeCount = data.totalLikeCount;
    const timestamp = getCurrentTimestamp();

    console.log(
      `[${username}] LIKE | ${user} sent ${likeCount} likes (Total: ${totalLikeCount})`
    );

    logToDatabase(tiktokLikeEvents, {
      streamerUsername: username,
      userNickname: user,
      likeCount,
      totalLikeCount,
      timestamp,
    });
  });

  // Listen for shares
  connection.on(WebcastEvent.SHARE, (data: any) => {
    const user = data.user?.nickname || "UnknownUser";
    const timestamp = getCurrentTimestamp();

    console.log(`[${username}] SHARE | ${user} shared the stream`);

    logToDatabase(tiktokShareEvents, {
      streamerUsername: username,
      userNickname: user,
      timestamp,
    });
  });

  // Listen for the stream ending - restart monitoring cycle
  connection.on(WebcastEvent.STREAM_END, () => {
    const timestamp = getCurrentTimestamp();
    console.log(`[${username}] STREAM_END | Stream for @${username} has ended`);

    // Update stream info to mark as offline
    updateStreamInfo(username, "", "", "", "", false);

    // Ensure clean disconnection
    if (connection.isConnected) {
      console.log(`[${username}] Disconnecting after stream end...`);
      connection.disconnect();
    }

    // Wait a bit then restart monitoring cycle
    setTimeout(() => {
      console.log(
        `[${username}] Restarting monitoring cycle after stream ended...`
      );
      startMonitoringCycle(username, connection);
    }, 5000); // Wait 5 seconds before restarting
  });

  // Listen for disconnection - restart monitoring cycle
  connection.on("disconnected" as any, (error: any) => {
    const timestamp = getCurrentTimestamp();
    console.error(
      `[${username}] DISCONNECTED | Connection lost: ${error?.message || error}`
    );

    // Update stream info to mark as offline
    updateStreamInfo(username, "", "", "", "", false);

    // Ensure clean disconnection state
    if (connection.isConnected) {
      console.log(
        `[${username}] Force disconnecting after disconnect event...`
      );
      connection.disconnect();
    }

    // Wait a bit then restart monitoring cycle
    setTimeout(() => {
      console.log(
        `[${username}] Restarting monitoring cycle after disconnection...`
      );
      startMonitoringCycle(username, connection);
    }, 10000); // Wait 10 seconds before restarting
  });
}

// Function to handle the complete monitoring cycle for a streamer
async function startMonitoringCycle(
  username: string,
  connection: TikTokLiveConnection
) {
  try {
    // First check if they're currently live
    console.log(`[${username}] Checking if streamer is live...`);

    const isLive = await connection.fetchIsLive();

    if (isLive) {
      console.log(`[${username}] Streamer is live! Connecting...`);
      await connectToStream(username, connection);
    } else {
      console.log(
        `[${username}] Streamer is offline. Waiting for them to go live...`
      );
      await waitForStreamToGoLive(username, connection);
    }
  } catch (error: any) {
    console.error(`[${username}] Error in monitoring cycle:`, error.message);

    // Retry after a delay
    setTimeout(() => {
      console.log(`[${username}] Retrying monitoring cycle...`);
      startMonitoringCycle(username, connection);
    }, 30000); // Wait 30 seconds before retrying
  }
}

// Function to wait for a streamer to go live
async function waitForStreamToGoLive(
  username: string,
  connection: TikTokLiveConnection
) {
  try {
    console.log(`[${username}] Waiting for streamer to go live...`);

    // Use the waitUntilLive method - this will block until they go live
    await connection.waitUntilLive();

    console.log(`[${username}] Streamer is now live! Connecting...`);
    await connectToStream(username, connection);
  } catch (error: any) {
    console.error(
      `[${username}] Error waiting for live status:`,
      error.message
    );

    // Retry after a delay
    setTimeout(() => {
      console.log(`[${username}] Retrying wait for live...`);
      waitForStreamToGoLive(username, connection);
    }, 60000); // Wait 1 minute before retrying
  }
}

// Function to connect to a live stream
async function connectToStream(
  username: string,
  connection: TikTokLiveConnection
) {
  try {
    // Safety check: ensure we're not already connected
    if (connection.isConnected) {
      console.log(`[${username}] Already connected, disconnecting first...`);
      connection.disconnect();
      // Wait a moment for clean disconnection
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const state = await connection.connect();
    console.info(
      `[${username}] Successfully connected to roomId: ${state.roomId}`
    );

    // Update stream info in database
    await updateStreamInfo(username, state.roomId);

    // Fetch room info to get HLS URL and other details
    try {
      const roomInfo = await connection.fetchRoomInfo();
      const hlsUrl = roomInfo.stream_url?.hls_pull_url;
      const createTime = roomInfo.create_time;
      const streamerBio = roomInfo.owner?.bio_description || "No bio available";

      console.log(`[${username}] Room info fetched successfully`);

      // Update stream info with additional details
      await updateStreamInfo(
        username,
        state.roomId,
        hlsUrl,
        createTime,
        streamerBio
      );

      if (hlsUrl) {
        console.log(`[${username}] HLS URL obtained`);
      } else {
        console.log(`[${username}] No HLS URL available`);
      }
    } catch (roomInfoError: any) {
      console.warn(
        `[${username}] Failed to fetch room info:`,
        roomInfoError.message
      );
    }
  } catch (error: any) {
    console.error(`[${username}] Failed to connect:`, error.message);

    // If connection fails, restart the monitoring cycle
    setTimeout(() => {
      console.log(
        `[${username}] Restarting monitoring cycle after connection failure...`
      );
      startMonitoringCycle(username, connection);
    }, 15000); // Wait 15 seconds before restarting
  }
}

// Function to monitor a single streamer with auto-reconnect
async function monitorStreamer(username: string) {
  // Create connection
  const connection = new TikTokLiveConnection(username);
  connections[username] = connection;

  // Enhanced event listeners with reconnection logic
  setupEventListenersWithReconnect(username, connection);

  // Start the monitoring cycle
  await startMonitoringCycle(username, connection);
}

// Initialize and connect to all streamers
async function initializeAllStreamers() {
  console.log(
    `Initializing monitoring for ${tiktokUsernames.length} streamer(s)...`
  );
  console.log(
    "Features: Auto-wait for live, Auto-reconnect on disconnect, Database logging"
  );

  for (const username of tiktokUsernames) {
    try {
      console.log(`[${username}] Starting monitoring...`);
      // Start monitoring each streamer independently
      monitorStreamer(username).catch((error) => {
        console.error(`Failed to start monitoring for @${username}:`, error);
      });
    } catch (error) {
      console.error(`Failed to initialize streamer @${username}:`, error);
    }
  }
}

// Export the main function and connections for external use
export { initializeAllStreamers, connections };
