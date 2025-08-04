import {
  TikTokLiveConnection,
  WebcastEvent,
  SignConfig,
} from "tiktok-live-connector";
import { IGetRateLimits } from "@eulerstream/euler-api-sdk";
import { AxiosResponse } from "axios";
import { db } from "../../../packages/db-schema";
import {
  tiktokChatEvents,
  tiktokGiftEvents,
  tiktokLikeEvents,
  tiktokShareEvents,
  tiktokMemberEvents,
  tiktokStreamInfo,
  trackedUsernames,
  streamSessions,
  streamHighlights,
  userStats,
} from "../../../packages/db-schema/schema";
import { eq } from "drizzle-orm";

SignConfig.apiKey = process.env.EULER_API_KEY;

// Store connections for each streamer
const connections: { [username: string]: TikTokLiveConnection } = {};

// Track current usernames and refresh state
let currentTrackedUsernames: string[] = [];
let lastUsernameRefresh: number = 0;
let usernameRefreshInterval: NodeJS.Timeout | null = null;

// Track active stream sessions
const activeSessions: { [username: string]: string } = {};

// Rate limiting and connection management
const connectionStates: {
  [username: string]: {
    isConnecting: boolean;
    lastCheck: number;
    retryCount: number;
    isLive: boolean;
    roomId?: string;
    currentSessionId?: string;
  };
} = {};

// Rate limiting configuration
const RATE_LIMIT = {
  CHECK_INTERVAL: 30000, // 30 seconds between live status checks
  MAX_RETRIES: 3,
  RETRY_DELAY: 60000, // 1 minute between retries
  CONNECTION_TIMEOUT: 10000, // 10 seconds connection timeout
  USERNAME_REFRESH_INTERVAL: 60000, // 1 minute between username refreshes
};

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

// Function to get tracked usernames from database
async function getTrackedUsernames(): Promise<string[]> {
  try {
    const results = await db
      .select({ username: trackedUsernames.username })
      .from(trackedUsernames)
      .where(eq(trackedUsernames.isActive, true));

    return results.map((r: { username: string }) => r.username);
  } catch (error) {
    console.error("Failed to fetch tracked usernames:", error);
    // Fallback to default usernames
    return [
      "rhiannonthatcherdesigns",
      "alhubbo",
      "prettylushdesigns",
      "dandbcreative",
    ];
  }
}

// Function to refresh usernames and manage connections
async function refreshUsernames() {
  try {
    const newUsernames = await getTrackedUsernames();
    const currentUsernames = new Set(currentTrackedUsernames);
    const newUsernamesSet = new Set(newUsernames);

    // Find usernames to add
    const usernamesToAdd = newUsernames.filter(
      (username) => !currentUsernames.has(username)
    );

    // Find usernames to remove
    const usernamesToRemove = currentTrackedUsernames.filter(
      (username) => !newUsernamesSet.has(username)
    );

    if (usernamesToAdd.length > 0) {
      console.log(
        `Adding new usernames to monitor: ${usernamesToAdd.join(", ")}`
      );
      for (const username of usernamesToAdd) {
        try {
          console.log(`[${username}] Starting monitoring...`);
          monitorStreamer(username).catch((error) => {
            console.error(
              `Failed to start monitoring for @${username}:`,
              error
            );
          });
        } catch (error) {
          console.error(`Failed to initialize streamer @${username}:`, error);
        }
      }
    }

    if (usernamesToRemove.length > 0) {
      console.log(
        `Removing usernames from monitoring: ${usernamesToRemove.join(", ")}`
      );
      for (const username of usernamesToRemove) {
        try {
          // Disconnect and cleanup
          const connection = connections[username];
          if (connection && connection.isConnected) {
            console.log(`[${username}] Disconnecting due to removal...`);
            connection.disconnect();
          }

          // Clean up state
          delete connections[username];
          delete connectionStates[username];
          delete activeSessions[username];

          console.log(`[${username}] Removed from monitoring`);
        } catch (error) {
          console.error(`Failed to remove streamer @${username}:`, error);
        }
      }
    }

    // Update current usernames list
    currentTrackedUsernames = newUsernames;
    lastUsernameRefresh = Date.now();

    if (usernamesToAdd.length > 0 || usernamesToRemove.length > 0) {
      console.log(
        `Username refresh completed. Now monitoring: ${currentTrackedUsernames.join(
          ", "
        )}`
      );
    }
  } catch (error) {
    console.error("Failed to refresh usernames:", error);
  }
}

// Function to start username refresh interval
function startUsernameRefresh() {
  if (usernameRefreshInterval) {
    clearInterval(usernameRefreshInterval);
  }

  usernameRefreshInterval = setInterval(async () => {
    await refreshUsernames();
  }, RATE_LIMIT.USERNAME_REFRESH_INTERVAL);

  console.log(
    `Started username refresh interval (${RATE_LIMIT.USERNAME_REFRESH_INTERVAL}ms)`
  );
}

// Function to stop username refresh interval
function stopUsernameRefresh() {
  if (usernameRefreshInterval) {
    clearInterval(usernameRefreshInterval);
    usernameRefreshInterval = null;
    console.log("Stopped username refresh interval");
  }
}

// Function to log events to database
async function logToDatabase(
  table: any,
  data: Record<string, any>
): Promise<void> {
  try {
    await db.withRetry(
      () => db.insert(table).values(data),
      "insert database record"
    );
  } catch (error) {
    console.error(`Failed to write to database:`, error);
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
      await db.withRetry(
        () =>
          db.insert(tiktokStreamInfo).values({
            streamerUsername: username,
            roomId,
            hlsUrl,
            createTime,
            streamerBio,
            isLive,
            lastUpdated: timestamp,
          }),
        "insert stream info"
      );
    }

    // Update lastSeen for tracked usernames
    if (isLive) {
      await db.withRetry(
        () =>
          db
            .update(trackedUsernames)
            .set({ lastSeen: timestamp })
            .where(eq(trackedUsernames.username, username)),
        "update tracked username last seen"
      );
    }
  } catch (error) {
    console.error(`Failed to update stream info for @${username}:`, error);
  }
}

// Function to start a new stream session
async function startStreamSession(
  username: string,
  roomId: string
): Promise<string> {
  try {
    const sessionId = `${username}_${Date.now()}`;
    const timestamp = getCurrentTimestamp();

    await db.withRetry(
      () =>
        db.insert(streamSessions).values({
          sessionId,
          streamerUsername: username,
          roomId,
          startTime: timestamp,
          endTime: null,
          duration: 0,
          totalLikes: 0,
          totalGifts: 0,
          totalComments: 0,
          totalShares: 0,
          totalMembers: 0,
        }),
      "insert stream session"
    );

    activeSessions[username] = sessionId;
    connectionStates[username] = {
      ...connectionStates[username],
      currentSessionId: sessionId,
    };

    console.log(`[${username}] Started new stream session: ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error(`Failed to start stream session for @${username}:`, error);
    return "";
  }
}

// Function to end a stream session
async function endStreamSession(username: string): Promise<void> {
  try {
    const sessionId = activeSessions[username];
    if (!sessionId) return;

    const timestamp = getCurrentTimestamp();

    // Get session start time to calculate duration
    const session = await db
      .select()
      .from(streamSessions)
      .where(eq(streamSessions.sessionId, sessionId))
      .limit(1);

    if (session.length > 0) {
      const startTime = new Date(session[0].startTime);
      const endTime = new Date(timestamp);
      const duration = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      );

      // Update session with end time and duration
      await db.withRetry(
        () =>
          db
            .update(streamSessions)
            .set({
              endTime: timestamp,
              duration,
            })
            .where(eq(streamSessions.sessionId, sessionId)),
        "update stream session end"
      );

      // Update tracked usernames stats
      const trackedUser = await db
        .select()
        .from(trackedUsernames)
        .where(eq(trackedUsernames.username, username))
        .limit(1);

      if (trackedUser.length > 0) {
        await db.withRetry(
          () =>
            db
              .update(trackedUsernames)
              .set({
                totalStreams: trackedUser[0].totalStreams + 1,
                totalDuration: trackedUser[0].totalDuration + duration,
              })
              .where(eq(trackedUsernames.username, username)),
          "update tracked username stats"
        );
      }

      console.log(
        `[${username}] Ended stream session: ${sessionId} (duration: ${duration}s)`
      );
    }

    delete activeSessions[username];
    if (connectionStates[username]) {
      connectionStates[username].currentSessionId = undefined;
    }
  } catch (error) {
    console.error(`Failed to end stream session for @${username}:`, error);
  }
}

// Helper function to update session stats
async function updateSessionStats(
  sessionId: string,
  field: string,
  increment: number = 1
): Promise<void> {
  try {
    const session = await db
      .select()
      .from(streamSessions)
      .where(eq(streamSessions.sessionId, sessionId))
      .limit(1);

    if (session.length > 0) {
      const currentValue = session[0][
        field as keyof (typeof session)[0]
      ] as number;
      await db.withRetry(
        () =>
          db
            .update(streamSessions)
            .set({ [field]: currentValue + increment })
            .where(eq(streamSessions.sessionId, sessionId)),
        `update session stats ${field}`
      );
    }
  } catch (error) {
    console.error(`Failed to update session stats for ${sessionId}:`, error);
  }
}

// Function to update user statistics
async function updateUserStats(
  username: string,
  userNickname: string,
  eventType: "gift" | "like" | "comment" | "share" | "member"
): Promise<void> {
  try {
    const timestamp = getCurrentTimestamp();

    // Check if user stats exist
    const existing = await db
      .select()
      .from(userStats)
      .where(eq(userStats.streamerUsername, username))
      .where(eq(userStats.userNickname, userNickname))
      .limit(1);

    if (existing.length > 0) {
      // Update existing stats
      const updateFields: any = { lastSeen: timestamp };

      switch (eventType) {
        case "gift":
          await db.withRetry(
            () =>
              db
                .update(userStats)
                .set({
                  totalGifts: existing[0].totalGifts + 1,
                  lastSeen: timestamp,
                })
                .where(eq(userStats.streamerUsername, username))
                .where(eq(userStats.userNickname, userNickname)),
            "update user stats gifts"
          );
          break;
        case "like":
          await db.withRetry(
            () =>
              db
                .update(userStats)
                .set({
                  totalLikes: existing[0].totalLikes + 1,
                  lastSeen: timestamp,
                })
                .where(eq(userStats.streamerUsername, username))
                .where(eq(userStats.userNickname, userNickname)),
            "update user stats likes"
          );
          break;
        case "comment":
          await db.withRetry(
            () =>
              db
                .update(userStats)
                .set({
                  totalComments: existing[0].totalComments + 1,
                  lastSeen: timestamp,
                })
                .where(eq(userStats.streamerUsername, username))
                .where(eq(userStats.userNickname, userNickname)),
            "update user stats comments"
          );
          break;
        case "share":
          await db.withRetry(
            () =>
              db
                .update(userStats)
                .set({
                  totalShares: existing[0].totalShares + 1,
                  lastSeen: timestamp,
                })
                .where(eq(userStats.streamerUsername, username))
                .where(eq(userStats.userNickname, userNickname)),
            "update user stats shares"
          );
          break;
        case "member":
          await db.withRetry(
            () =>
              db
                .update(userStats)
                .set({
                  totalMemberships: existing[0].totalMemberships + 1,
                  lastSeen: timestamp,
                })
                .where(eq(userStats.streamerUsername, username))
                .where(eq(userStats.userNickname, userNickname)),
            "update user stats memberships"
          );
          break;
      }
    } else {
      // Insert new user stats
      const stats = {
        streamerUsername: username,
        userNickname,
        totalGifts: eventType === "gift" ? 1 : 0,
        totalLikes: eventType === "like" ? 1 : 0,
        totalComments: eventType === "comment" ? 1 : 0,
        totalShares: eventType === "share" ? 1 : 0,
        totalMemberships: eventType === "member" ? 1 : 0,
        firstSeen: timestamp,
        lastSeen: timestamp,
      };

      await db.withRetry(
        () => db.insert(userStats).values(stats),
        "insert new user stats"
      );
    }
  } catch (error) {
    console.error(
      `Failed to update user stats for @${username}/${userNickname}:`,
      error
    );
  }
}

// Enhanced event listeners that handle reconnection and database logging
function setupEventListenersWithReconnect(
  username: string,
  connection: TikTokLiveConnection
) {
  // Only check rate limits once per connection setup
  connection.webClient.webSigner.webcast
    .getRateLimits()
    .then((response: AxiosResponse<IGetRateLimits>) => {
      console.log(`[${username}] Rate Limits:`, response.data);
    })
    .catch((error) => {
      console.warn(`[${username}] Failed to get rate limits:`, error.message);
    });

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

    // Update user stats
    updateUserStats(username, user, "comment");

    // Update session stats
    const sessionId = activeSessions[username];
    if (sessionId) {
      updateSessionStats(sessionId, "totalComments", 1);
    }
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

    // Update user stats
    updateUserStats(username, user, "gift");

    // Update session stats
    const sessionId = activeSessions[username];
    if (sessionId) {
      updateSessionStats(sessionId, "totalGifts", repeatCount);
    }
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

    // Update user stats
    updateUserStats(username, user, "member");

    // Update session stats
    const sessionId = activeSessions[username];
    if (sessionId) {
      updateSessionStats(sessionId, "totalMembers", 1);
    }
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

    // Update user stats
    updateUserStats(username, user, "like");

    // Update session stats
    const sessionId = activeSessions[username];
    if (sessionId) {
      updateSessionStats(sessionId, "totalLikes", likeCount);
    }
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

    // Update user stats
    updateUserStats(username, user, "share");

    // Update session stats
    const sessionId = activeSessions[username];
    if (sessionId) {
      updateSessionStats(sessionId, "totalShares", 1);
    }
  });

  // Listen for the stream ending - restart monitoring cycle
  connection.on(WebcastEvent.STREAM_END, () => {
    const timestamp = getCurrentTimestamp();
    console.log(`[${username}] STREAM_END | Stream for @${username} has ended`);

    // End current session
    endStreamSession(username);

    // Update connection state
    connectionStates[username] = {
      ...connectionStates[username],
      isLive: false,
      isConnecting: false,
    };

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
    }, RATE_LIMIT.RETRY_DELAY);
  });

  // Listen for disconnection - restart monitoring cycle
  connection.on("disconnected" as any, (error: any) => {
    const timestamp = getCurrentTimestamp();
    console.error(
      `[${username}] DISCONNECTED | Connection lost: ${error?.message || error}`
    );

    // End current session
    endStreamSession(username);

    // Update connection state
    connectionStates[username] = {
      ...connectionStates[username],
      isLive: false,
      isConnecting: false,
    };

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
    }, RATE_LIMIT.RETRY_DELAY);
  });
}

// Function to check if enough time has passed since last check
function canCheckLiveStatus(username: string): boolean {
  const state = connectionStates[username];
  if (!state) return true;

  const timeSinceLastCheck = Date.now() - state.lastCheck;
  return timeSinceLastCheck >= RATE_LIMIT.CHECK_INTERVAL;
}

// Function to handle the complete monitoring cycle for a streamer
async function startMonitoringCycle(
  username: string,
  connection: TikTokLiveConnection
) {
  try {
    // Initialize connection state if not exists
    if (!connectionStates[username]) {
      connectionStates[username] = {
        isConnecting: false,
        lastCheck: 0,
        retryCount: 0,
        isLive: false,
      };
    }

    const state = connectionStates[username];

    // Rate limiting: don't check too frequently
    if (!canCheckLiveStatus(username)) {
      console.log(`[${username}] Rate limited, skipping check...`);
      setTimeout(() => startMonitoringCycle(username, connection), 10000);
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (state.isConnecting) {
      console.log(`[${username}] Already attempting to connect, skipping...`);
      return;
    }

    state.isConnecting = true;
    state.lastCheck = Date.now();

    console.log(`[${username}] Checking if streamer is live...`);

    const isLive = await connection.fetchIsLive();
    state.isLive = isLive;

    if (isLive) {
      console.log(`[${username}] Streamer is live! Connecting...`);
      state.retryCount = 0; // Reset retry count on success
      await connectToStream(username, connection);
    } else {
      console.log(
        `[${username}] Streamer is offline. Waiting for them to go live...`
      );
      state.retryCount = 0; // Reset retry count on success
      await waitForStreamToGoLive(username, connection);
    }
  } catch (error: any) {
    console.error(`[${username}] Error in monitoring cycle:`, error.message);

    const state = connectionStates[username];
    state.retryCount++;
    state.isConnecting = false;

    // Exponential backoff for retries
    const retryDelay = Math.min(
      RATE_LIMIT.RETRY_DELAY * Math.pow(2, state.retryCount),
      300000 // Max 5 minutes
    );

    if (state.retryCount <= RATE_LIMIT.MAX_RETRIES) {
      console.log(
        `[${username}] Retrying monitoring cycle in ${retryDelay}ms (attempt ${state.retryCount}/${RATE_LIMIT.MAX_RETRIES})`
      );
      setTimeout(() => {
        startMonitoringCycle(username, connection);
      }, retryDelay);
    } else {
      console.error(
        `[${username}] Max retries reached, stopping monitoring for this streamer`
      );
      state.retryCount = 0; // Reset for next attempt
    }
  } finally {
    const state = connectionStates[username];
    if (state) {
      state.isConnecting = false;
    }
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
    }, RATE_LIMIT.RETRY_DELAY);
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

    // Start a new stream session
    await startStreamSession(username, state.roomId);

    // Update connection state
    connectionStates[username] = {
      ...connectionStates[username],
      isLive: true,
      roomId: state.roomId,
    };

    // Update stream info in database
    await updateStreamInfo(username, state.roomId);

    // Fetch room info to get HLS URL and other details (only once per connection)
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

    // Update connection state
    connectionStates[username] = {
      ...connectionStates[username],
      isLive: false,
      isConnecting: false,
    };

    // If connection fails, restart the monitoring cycle
    setTimeout(() => {
      console.log(
        `[${username}] Restarting monitoring cycle after connection failure...`
      );
      startMonitoringCycle(username, connection);
    }, RATE_LIMIT.RETRY_DELAY);
  }
}

// Function to monitor a single streamer with auto-reconnect
async function monitorStreamer(username: string) {
  // Create connection
  const connection = new TikTokLiveConnection(username);
  connections[username] = connection;

  // Initialize connection state
  connectionStates[username] = {
    isConnecting: false,
    lastCheck: 0,
    retryCount: 0,
    isLive: false,
  };

  // Enhanced event listeners with reconnection logic
  setupEventListenersWithReconnect(username, connection);

  // Start the monitoring cycle
  await startMonitoringCycle(username, connection);
}

// Initialize and connect to all streamers
async function initializeAllStreamers() {
  console.log("Initializing TikTok monitoring system...");
  console.log(
    "Features: Auto-wait for live, Auto-reconnect on disconnect, Database logging, Rate limiting, Automatic username refresh"
  );

  // Get initial usernames from database
  currentTrackedUsernames = await getTrackedUsernames();

  console.log(
    `Initializing monitoring for ${currentTrackedUsernames.length} streamer(s)...`
  );

  for (const username of currentTrackedUsernames) {
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

  // Start automatic username refresh
  startUsernameRefresh();
}

// Function to stop all monitoring
async function stopAllMonitoring() {
  console.log("Stopping all TikTok monitoring...");

  // Stop username refresh
  stopUsernameRefresh();

  // Disconnect all connections
  for (const [username, connection] of Object.entries(connections)) {
    try {
      if (connection.isConnected) {
        console.log(`[${username}] Disconnecting...`);
        connection.disconnect();
      }
    } catch (error) {
      console.error(`Failed to disconnect @${username}:`, error);
    }
  }

  // Clear all state
  Object.keys(connections).forEach((username) => {
    delete connections[username];
    delete connectionStates[username];
    delete activeSessions[username];
  });

  currentTrackedUsernames = [];
  console.log("All monitoring stopped");
}

// Export the main functions for external use
export { initializeAllStreamers, stopAllMonitoring, connections };
