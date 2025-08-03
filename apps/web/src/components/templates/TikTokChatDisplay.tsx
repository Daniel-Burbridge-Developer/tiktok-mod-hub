import { useState, useEffect } from "react";

interface TikTokEvent {
  id: number;
  streamerUsername: string;
  userNickname: string;
  timestamp: string;
  comment?: string;
  giftId?: string;
  repeatCount?: number;
  likeCount?: number;
  totalLikeCount?: number;
  type?: string;
}

interface StreamInfo {
  id: number;
  streamerUsername: string;
  roomId: string;
  hlsUrl?: string;
  createTime?: string;
  streamerBio?: string;
  isLive: boolean;
  lastUpdated: string;
}

interface ChatData {
  events: TikTokEvent[];
  streamInfo: StreamInfo[];
  totalEvents: number;
  eventType: string;
  streamer: string;
}

function TikTokChatDisplay() {
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStreamer, setSelectedStreamer] = useState<string>("all");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchChatData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStreamer !== "all") {
        params.append("streamer", selectedStreamer);
      }
      if (selectedEventType !== "all") {
        params.append("type", selectedEventType);
      }
      params.append("limit", "100");

      const response = await fetch(`/api/tiktok-chat?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch chat data");
      }
      const data = await response.json();
      setChatData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatData();
  }, [selectedStreamer, selectedEventType]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchChatData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, selectedStreamer, selectedEventType]);

  const getEventIcon = (event: TikTokEvent) => {
    const type =
      event.type ||
      (event.comment
        ? "chat"
        : event.giftId
        ? "gift"
        : event.likeCount
        ? "like"
        : event.userNickname
        ? "member"
        : "share");

    switch (type) {
      case "chat":
        return "💬";
      case "gift":
        return "🎁";
      case "like":
        return "❤️";
      case "share":
        return "📤";
      case "member":
        return "👤";
      default:
        return "📝";
    }
  };

  const getEventDescription = (event: TikTokEvent) => {
    const type =
      event.type ||
      (event.comment
        ? "chat"
        : event.giftId
        ? "gift"
        : event.likeCount
        ? "like"
        : event.userNickname
        ? "member"
        : "share");

    switch (type) {
      case "chat":
        return event.comment || "";
      case "gift":
        return `sent gift ${event.giftId} (x${event.repeatCount})`;
      case "like":
        return `sent ${event.likeCount} likes (Total: ${event.totalLikeCount})`;
      case "share":
        return "shared the stream";
      case "member":
        return "joined the stream";
      default:
        return "";
    }
  };

  const getStreamerOptions = () => {
    if (!chatData?.streamInfo) return [];
    return [
      { value: "all", label: "All Streamers" },
      ...chatData.streamInfo.map((stream) => ({
        value: stream.streamerUsername,
        label: `@${stream.streamerUsername} ${
          stream.isLive ? "🔴 LIVE" : "⚫ OFFLINE"
        }`,
      })),
    ];
  };

  if (loading && !chatData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading TikTok chat data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading chat data
            </h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <button
              onClick={fetchChatData}
              className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                TikTok Live Chat Monitor
              </h1>
              <p className="text-purple-100 mt-1">
                Real-time monitoring of live streams and chat events
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center text-white">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                Auto-refresh
              </label>
              <button
                onClick={fetchChatData}
                disabled={loading}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Streamer
              </label>
              <select
                value={selectedStreamer}
                onChange={(e) => setSelectedStreamer(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {getStreamerOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Type
              </label>
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Events</option>
                <option value="chat">Chat Messages</option>
                <option value="gifts">Gifts</option>
                <option value="likes">Likes</option>
                <option value="shares">Shares</option>
                <option value="members">Members</option>
              </select>
            </div>
            <div className="text-sm text-gray-600">
              Total Events: {chatData?.totalEvents || 0}
            </div>
          </div>
        </div>

        {/* Live Stream Status */}
        {chatData?.streamInfo && chatData.streamInfo.length > 0 && (
          <div className="bg-blue-50 px-6 py-3 border-b">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              Stream Status
            </h3>
            <div className="flex flex-wrap gap-3">
              {chatData.streamInfo.map((stream) => (
                <div
                  key={stream.streamerUsername}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    stream.isLive
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  @{stream.streamerUsername}{" "}
                  {stream.isLive ? "🔴 LIVE" : "⚫ OFFLINE"}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Events */}
        <div className="max-h-96 overflow-y-auto">
          {chatData?.events && chatData.events.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {chatData.events.map((event) => (
                <div
                  key={event.id}
                  className="px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 text-lg">
                      {getEventIcon(event)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {event.userNickname}
                        </span>
                        <span className="text-xs text-gray-500">
                          @{event.streamerUsername}
                        </span>
                        <span className="text-xs text-gray-400">
                          {event.timestamp}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        {getEventDescription(event)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              <div className="text-4xl mb-4">📱</div>
              <p className="text-lg font-medium">No events found</p>
              <p className="text-sm">
                Start monitoring a live stream to see chat events here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TikTokChatDisplay;
