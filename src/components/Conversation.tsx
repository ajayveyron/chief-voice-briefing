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

  return (
    <div className="flex flex-col items-center gap-4">
      {userFirstName && (
        <p className="text-sm text-gray-100 mb-1">Hello {userFirstName}!</p>
      )}
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
