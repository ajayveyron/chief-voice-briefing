"use client";

import { useCallback } from "react";
import { useChiefConversation } from "@/hooks/useChiefConversation";
import { ChiefLoadingIndicators } from "@/components/ChiefLoadingIndicators";
import { ConversationStatus } from "@/components/ConversationStatus";
import { supabase } from "@/integrations/supabase/client";

// Vector search function for voice assistant
const performVectorSearch = async (query: string, user_id: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("vector-search", {
      body: {
        query,
        user_id,
        topK: 3, // Get top 3 most relevant results for voice context
      },
    });

    if (error) {
      console.error("Vector search error:", error);
      return [];
    }

    return data.results || [];
  } catch (error) {
    console.error("Vector search failed:", error);
    return [];
  }
};

export function Conversation() {
  const {
    conversation,
    userFirstName,
    userPreferences,
    userContacts,
    availableTools,
    isLoadingUserData,
    isLoadingTools,
    startConversation,
    stopConversation,
    isReady,
  } = useChiefConversation();

  const handleStartConversation = useCallback(async () => {
    await startConversation();
  }, [startConversation]);

  const handleStopConversation = useCallback(async () => {
    await stopConversation();
  }, [stopConversation]);

  // Test MCP tools directly
  const testVectorSearch = useCallback(async () => {
    console.log("🧪 Testing vector_search tool manually...");
    try {
      const { mcpClient } = await import("@/lib/mcp-client");
      const result = await mcpClient.executeTool(
        "local-tools",
        "vector_search",
        { query: "test search", topK: 3 }
      );
      console.log("🧪 Vector search test result:", result);
      alert(
        `Vector search test: ${
          result.success ? "SUCCESS" : "FAILED"
        }\nCheck console for details`
      );
    } catch (error) {
      console.error("🧪 Vector search test failed:", error);
      alert(`Vector search test FAILED: ${error}`);
    }
  }, []);

  const testGetUpdates = useCallback(async () => {
    console.log("🧪 Testing get_updates tool manually...");
    try {
      const { mcpClient } = await import("@/lib/mcp-client");
      const result = await mcpClient.executeTool("local-tools", "get_updates", {
        unread_only: true,
      });
      console.log("🧪 Get updates test result:", result);
      alert(
        `Get updates test: ${
          result.success ? "SUCCESS" : "FAILED"
        }\nCheck console for details`
      );
    } catch (error) {
      console.error("🧪 Get updates test failed:", error);
      alert(`Get updates test FAILED: ${error}`);
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {userFirstName && (
        <p className="text-sm text-gray-100 mb-1">Hello {userFirstName}!</p>
      )}

      {/* Main conversation controls */}
      <div className="flex gap-2">
        <button
          onClick={handleStartConversation}
          disabled={conversation.status === "connected" || !isReady}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Start Conversation
        </button>
        <button
          onClick={handleStopConversation}
          disabled={conversation.status !== "connected"}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300"
        >
          Stop Conversation
        </button>
      </div>

      {/* Debug info */}
      <div className="text-xs text-gray-300 text-center">
        Status: {conversation.status} | Tools: {availableTools.length} | Ready:{" "}
        {isReady ? "Yes" : "No"}
      </div>

      {/* Test buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={testVectorSearch}
          disabled={isLoadingTools}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded disabled:bg-gray-400"
        >
          🧪 Test Vector Search
        </button>
        <button
          onClick={testGetUpdates}
          disabled={isLoadingTools}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded disabled:bg-gray-400"
        >
          🧪 Test Get Updates
        </button>
      </div>

      <div className="text-xs text-gray-400 text-center max-w-md">
        Use test buttons to verify MCP tools work. Check browser console for
        detailed logs.
        <br />
        Try saying: "search my emails" or "what's new?" to the voice assistant.
      </div>

      {/* <ConversationStatus
        status={conversation.status}
        isSpeaking={conversation.isSpeaking}
      />

      <ChiefLoadingIndicators
        isLoadingUserData={isLoadingUserData}
        isLoadingTools={isLoadingTools}
        userPreferences={userPreferences}
        userContacts={userContacts}
        availableTools={availableTools}
      /> */}
    </div>
  );
}
