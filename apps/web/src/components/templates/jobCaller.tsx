// apps/Tiktok-mod-hub/src/components/templates/jobCaller.tsx (example component)
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

function JobCaller() {
  const [statusMessage, setStatusMessage] = useState("");
  const router = useRouter();

  const handleStartJob = async () => {
    try {
      const response = await fetch("/api/job", {
        method: "POST",
      });
      if (response.ok) {
        setStatusMessage("Attempting to start background job...");
      } else {
        setStatusMessage("Failed to send start command.");
      }
    } catch (error) {
      setStatusMessage("Failed to send start command.");
      console.error(error);
    }
  };

  const handleStopJob = async () => {
    try {
      const response = await fetch("/api/job", {
        method: "DELETE",
      });
      if (response.ok) {
        setStatusMessage("Attempting to stop background job...");
      } else {
        setStatusMessage("Failed to send stop command.");
      }
    } catch (error) {
      setStatusMessage("Failed to send stop command.");
      console.error(error);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg flex flex-col items-center space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Tiktok Mod Hub</h1>
      <p
        className={`min-h-[1.5rem] text-center text-sm ${
          statusMessage ? "text-blue-600 font-medium" : "text-gray-400 italic"
        }`}
      >
        {statusMessage || "No job status yet."}
      </p>
      <div className="flex space-x-4">
        <button
          onClick={handleStartJob}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition font-semibold shadow focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          Start Background Job
        </button>
        <button
          onClick={handleStopJob}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition font-semibold shadow focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          Stop Background Job
        </button>
      </div>
    </div>
  );
}

export default JobCaller;
