import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import * as fs from "fs/promises"; // Import the promises version of fs
import * as path from "path"; // For working with file paths
import { fileURLToPath } from "url";
import { dirname } from "path";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Array of TikTok usernames to monitor (replace with usernames that are currently LIVE)
const tiktokUsernames = ["rhiannonthatcherdesigns", "alhubbo"];

// Store connections for each streamer
const connections: { [username: string]: TikTokLiveConnection } = {};

// Create log file paths for each streamer and event type
function getLogPath(username: string, eventType: string): string {
  return path.join(__dirname, "..", "logs", username, `${eventType}.txt`);
}

async function initializeLogFiles(username: string) {
  try {
    const userLogDir = path.join(__dirname, "..", "logs", username);
    await fs.mkdir(userLogDir, { recursive: true }); // Ensure user-specific log directory exists

    // Create separate files for each event type
    const eventTypes = [
      "chat",
      "gifts",
      "likes",
      "shares",
      "members",
      "errors",
      "info",
    ];
    for (const eventType of eventTypes) {
      const logPath = getLogPath(username, eventType);
      // Ensure file exists (create if it doesn't)
      try {
        await fs.access(logPath);
      } catch {
        await fs.writeFile(logPath, "", "utf-8");
      }
    }

    console.log(`Log files initialized for @${username} in: ${userLogDir}`);
  } catch (error) {
    console.error(`Failed to initialize log files for @${username}:`, error);
    process.exit(1);
  }
}

async function logToFile(username: string, eventType: string, message: string) {
  try {
    // Use local timezone instead of UTC
    const timestamp = new Date().toLocaleString("en-AU", {
      timeZone: "Australia/Perth",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const logEntry = `[${timestamp} AWST] ${message}\n`;
    const filePath = getLogPath(username, eventType);
    await fs.appendFile(filePath, logEntry, "utf-8");
  } catch (error) {
    console.error(
      `Failed to write to log file for @${username} (${eventType}):`,
      error
    );
  }
}

// Function to monitor a single streamer with auto-reconnect
async function monitorStreamer(username: string) {
  // Initialize log files for this streamer
  await initializeLogFiles(username);

  // Create connection
  const connection = new TikTokLiveConnection(username);
  connections[username] = connection;

  // Enhanced event listeners with reconnection logic
  setupEventListenersWithReconnect(username, connection);

  // Start the monitoring cycle
  await startMonitoringCycle(username, connection);
}

// Enhanced event listeners that handle reconnection
function setupEventListenersWithReconnect(
  username: string,
  connection: TikTokLiveConnection
) {
  // Listen for chat messages (comments)
  connection.on(WebcastEvent.CHAT, (data) => {
    const user = data.user?.nickname || "UnknownUser";
    const comment = data.comment;
    const cleanedComment = comment.trim().replace(/\s+/g, " ");
    const logMessage = `${user}: ${cleanedComment}`;
    console.log(`[${username}] CHAT | ${logMessage}`);
    logToFile(username, "chat", logMessage);
  });

  // Listen for gifts
  connection.on(WebcastEvent.GIFT, (data) => {
    const user = data.user?.nickname || "UnknownUser";
    const giftId = data.giftId;
    const repeatCount = data.repeatCount;
    const logMessage = `${user} sent gift ${giftId} (x${repeatCount})`;
    console.log(`[${username}] GIFT | ${logMessage}`);
    logToFile(username, "gifts", logMessage);
  });

  // Listen for new members joining
  connection.on(WebcastEvent.MEMBER, (data) => {
    const user = data.user?.nickname || "UnknownUser";
    const logMessage = `${user} joined the stream`;
    console.log(`[${username}] MEMBER | ${logMessage}`);
    logToFile(username, "members", logMessage);
  });

  // Listen for likes
  connection.on(WebcastEvent.LIKE, (data) => {
    const user = data.user?.nickname || "UnknownUser";
    const likeCount = data.likeCount;
    const totalLikeCount = data.totalLikeCount;
    const logMessage = `${user} sent ${likeCount} likes (Total: ${totalLikeCount})`;
    console.log(`[${username}] LIKE | ${logMessage}`);
    logToFile(username, "likes", logMessage);
  });

  // Listen for shares
  connection.on(WebcastEvent.SHARE, (data) => {
    const user = data.user?.nickname || "UnknownUser";
    const logMessage = `${user} shared the stream`;
    console.log(`[${username}] SHARE | ${logMessage}`);
    logToFile(username, "shares", logMessage);
  });

  // Listen for the stream ending - restart monitoring cycle
  connection.on(WebcastEvent.STREAM_END, () => {
    const logMessage = `Stream for @${username} has ended`;
    console.log(`[${username}] STREAM_END | ${logMessage}`);
    logToFile(username, "info", logMessage);

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
      logToFile(
        username,
        "info",
        "Restarting monitoring cycle after stream ended"
      );
      startMonitoringCycle(username, connection);
    }, 5000); // Wait 5 seconds before restarting
  });

  // Listen for disconnection - restart monitoring cycle
  connection.on("disconnected" as any, (error: any) => {
    const logMessage = `Connection lost: ${error?.message || error}`;
    console.error(`[${username}] DISCONNECTED | ${logMessage}`);
    logToFile(username, "errors", logMessage);

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
      logToFile(
        username,
        "info",
        "Restarting monitoring cycle after disconnection"
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
    logToFile(username, "info", "Checking live status");

    const isLive = await connection.fetchIsLive();

    if (isLive) {
      console.log(`[${username}] Streamer is live! Connecting...`);
      logToFile(username, "info", "Streamer is live, attempting to connect");
      await connectToStream(username, connection);
    } else {
      console.log(
        `[${username}] Streamer is offline. Waiting for them to go live...`
      );
      logToFile(
        username,
        "info",
        "Streamer is offline, waiting for live status"
      );
      await waitForStreamToGoLive(username, connection);
    }
  } catch (error: any) {
    console.error(`[${username}] Error in monitoring cycle:`, error.message);
    logToFile(username, "errors", `Monitoring cycle error: ${error.message}`);

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
    logToFile(username, "info", "Started waiting for streamer to go live");

    // Use the waitUntilLive method - this will block until they go live
    await connection.waitUntilLive();

    console.log(`[${username}] Streamer is now live! Connecting...`);
    logToFile(username, "info", "Streamer went live, connecting now");

    await connectToStream(username, connection);
  } catch (error: any) {
    console.error(
      `[${username}] Error waiting for live status:`,
      error.message
    );
    logToFile(username, "errors", `Wait for live error: ${error.message}`);

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
      logToFile(
        username,
        "info",
        "Already connected, disconnecting before reconnect"
      );
      connection.disconnect();
      // Wait a moment for clean disconnection
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const state = await connection.connect();
    console.info(
      `[${username}] Successfully connected to roomId: ${state.roomId}`
    );
    logToFile(
      username,
      "info",
      `Successfully connected to roomId: ${state.roomId}`
    );

    // Fetch room info to get HLS URL and other details
    try {
      const roomInfo = await connection.fetchRoomInfo();
      const hlsUrl = roomInfo.stream_url?.hls_pull_url;
      const createTime = roomInfo.create_time;
      const streamerBio = roomInfo.owner?.bio_description || "No bio available";

      console.log(`[${username}] Room info fetched successfully`);

      // Log detailed room information
      logToFile(username, "info", `Stream started timestamp: ${createTime}`);
      logToFile(username, "info", `Streamer bio: ${streamerBio}`);

      if (hlsUrl) {
        console.log(`[${username}] HLS URL obtained`);
        logToFile(username, "info", `HLS URL: ${hlsUrl}`);
        logToFile(
          username,
          "info",
          `Note: HLS URL can be played or recorded with VLC or similar tools`
        );
      } else {
        console.log(`[${username}] No HLS URL available`);
        logToFile(username, "info", "HLS URL: Not available");
      }
    } catch (roomInfoError: any) {
      console.warn(
        `[${username}] Failed to fetch room info:`,
        roomInfoError.message
      );
      logToFile(
        username,
        "errors",
        `Failed to fetch room info: ${roomInfoError.message}`
      );
    }
  } catch (error: any) {
    console.error(`[${username}] Failed to connect:`, error.message);
    logToFile(username, "errors", `Failed to connect: ${error.message}`);

    // If connection fails, restart the monitoring cycle
    setTimeout(() => {
      console.log(
        `[${username}] Restarting monitoring cycle after connection failure...`
      );
      startMonitoringCycle(username, connection);
    }, 15000); // Wait 15 seconds before restarting
  }
}

// Initialize and connect to all streamers
async function initializeAllStreamers() {
  console.log(
    `Initializing monitoring for ${tiktokUsernames.length} streamer(s)...`
  );
  console.log("Features: Auto-wait for live, Auto-reconnect on disconnect");

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

// Start monitoring
initializeAllStreamers();

// Graceful shutdown on SIGINT (Ctrl+C)
process.on("SIGINT", () => {
  console.log("\nDisconnecting from all TikTok Live streams...");

  // Disconnect all connections
  for (const [username, connection] of Object.entries(connections)) {
    console.log(`Disconnecting from @${username}...`);
    connection.disconnect();
    logToFile(
      username,
      "info",
      "Daemon gracefully shutting down due to SIGINT"
    );
  }

  console.log("All connections closed. Exiting...");
  process.exit(0);
});
