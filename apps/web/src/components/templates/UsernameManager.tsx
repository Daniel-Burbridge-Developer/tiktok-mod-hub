import { useState, useEffect } from "react";

interface TrackedUsername {
  id: number;
  username: string;
  displayName?: string;
  isActive: boolean;
  addedAt: string;
  lastSeen?: string;
  totalStreams: number;
  totalDuration: number;
  notes?: string;
  recentSessions?: any[];
  topFans?: any[];
}

function UsernameManager() {
  const [usernames, setUsernames] = useState<TrackedUsername[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUsername, setEditingUsername] = useState<TrackedUsername | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const fetchUsernames = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tracked-usernames?stats=true");
      if (!response.ok) {
        throw new Error("Failed to fetch usernames");
      }
      const data = await response.json();
      setUsernames(data.usernames);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsernames();
  }, []);

  const handleAddUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/tracked-usernames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          displayName: newDisplayName,
          notes: newNotes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add username");
      }

      setNewUsername("");
      setNewDisplayName("");
      setNewNotes("");
      setShowAddForm(false);
      fetchUsernames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add username");
    }
  };

  const handleUpdateUsername = async (username: TrackedUsername) => {
    try {
      const response = await fetch("/api/tracked-usernames", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: username.id,
          isActive: username.isActive,
          displayName: username.displayName,
          notes: username.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update username");
      }

      setEditingUsername(null);
      fetchUsernames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update username");
    }
  };

  const handleDeleteUsername = async (id: number) => {
    if (!confirm("Are you sure you want to remove this username from tracking?")) {
      return;
    }

    try {
      const response = await fetch(`/api/tracked-usernames?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete username");
      }

      fetchUsernames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete username");
    }
  };

  const toggleActive = async (username: TrackedUsername) => {
    const updatedUsername = { ...username, isActive: !username.isActive };
    await handleUpdateUsername(updatedUsername);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return "Never";
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading tracked usernames...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Tracked Usernames</h1>
              <p className="text-green-100 mt-1">
                Manage TikTok usernames to monitor
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {showAddForm ? "Cancel" : "Add Username"}
            </button>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-gray-50 px-6 py-4 border-b">
            <form onSubmit={handleAddUsername} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="@username"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Add Username
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 px-6 py-3">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Usernames List */}
        <div className="divide-y divide-gray-200">
          {usernames.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <div className="text-4xl mb-4">📱</div>
              <p className="text-lg font-medium">No tracked usernames</p>
              <p className="text-sm">Add some usernames to start monitoring their streams.</p>
            </div>
          ) : (
            usernames.map((username) => (
              <div key={username.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${username.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          @{username.username}
                        </h3>
                        {username.displayName && username.displayName !== username.username && (
                          <p className="text-sm text-gray-500">{username.displayName}</p>
                        )}
                        {username.notes && (
                          <p className="text-sm text-gray-600 mt-1">{username.notes}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Last Seen:</span> {formatLastSeen(username.lastSeen)}
                      </div>
                      <div>
                        <span className="font-medium">Total Streams:</span> {username.totalStreams}
                      </div>
                      <div>
                        <span className="font-medium">Total Duration:</span> {formatDuration(username.totalDuration)}
                      </div>
                      <div>
                        <span className="font-medium">Added:</span> {new Date(username.addedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    {username.recentSessions && username.recentSessions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Recent Sessions:</p>
                        <div className="flex flex-wrap gap-2">
                          {username.recentSessions.slice(0, 3).map((session: any, index: number) => (
                            <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {new Date(session.startTime).toLocaleDateString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Fans */}
                    {username.topFans && username.topFans.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Top Fans:</p>
                        <div className="flex flex-wrap gap-2">
                          {username.topFans.slice(0, 3).map((fan: any, index: number) => (
                            <span key={index} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              {fan.username} ({fan.totalGifts} gifts)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => toggleActive(username)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        username.isActive
                          ? "bg-red-100 text-red-800 hover:bg-red-200"
                          : "bg-green-100 text-green-800 hover:bg-green-200"
                      }`}
                    >
                      {username.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => setEditingUsername(editingUsername?.id === username.id ? null : username)}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUsername(username.id)}
                      className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                {editingUsername?.id === username.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateUsername(editingUsername); }}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={editingUsername.displayName || ""}
                            onChange={(e) => setEditingUsername({...editingUsername, displayName: e.target.value})}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={editingUsername.notes || ""}
                            onChange={(e) => setEditingUsername({...editingUsername, notes: e.target.value})}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors mr-2"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUsername(null)}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default UsernameManager; 