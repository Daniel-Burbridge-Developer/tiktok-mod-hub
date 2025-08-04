import { createFileRoute } from "@tanstack/react-router";
import JobCaller from "~/components/templates/jobCaller";
import TikTokChatDisplay from "~/components/templates/TikTokChatDisplay";
import UsernameManager from "~/components/templates/UsernameManager";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="p-2 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          TikTok Mod Hub
        </h1>
        <p className="text-gray-600">Monitor and manage TikTok live streams</p>
      </div>

      <JobCaller />

      <UsernameManager />

      <TikTokChatDisplay />
    </div>
  );
}
