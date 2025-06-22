"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button"; // Assuming you're using shadcn/ui
import { Mic, MicOff, Loader2 } from "lucide-react";

export function Conversation() {
  const [isLoading, setIsLoading] = useState(false);
  const conversation = useConversation({
    onConnect: () => console.log("Connected"),
    onDisconnect: () => console.log("Disconnected"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => console.error("Error:", error),
  });

  const toggleConversation = useCallback(async () => {
    setIsLoading(true);
    try {
      if (conversation.status === "connected") {
        await conversation.endSession();
      } else {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true });
        // Start the conversation with your agent
        await conversation.startSession({
          agentId: "agent_01jxze02qqem3bpzsegmbsfv67", // Replace with your agent ID
        });
      }
    } catch (error) {
      console.error("Conversation error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversation]);

  const getButtonVariant = () => {
    if (isLoading) return "secondary";
    return conversation.status === "connected" ? "destructive" : "default";
  };

  const getButtonText = () => {
    if (isLoading) return "Processing...";
    return conversation.status === "connected"
      ? "Stop Conversation"
      : "Start Conversation";
  };

  const getButtonIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    return conversation.status === "connected" ? (
      <MicOff className="h-4 w-4" />
    ) : (
      <Mic className="h-4 w-4" />
    );
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <Button
        onClick={toggleConversation}
        disabled={isLoading}
        variant={getButtonVariant()}
        className="gap-2 min-w-[200px] transition-all"
      >
        {getButtonIcon()}
        {getButtonText()}
      </Button>

      <div className="flex flex-col items-center gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Status:</span>
          <span
            className={`px-2 py-1 rounded-md text-xs ${
              conversation.status === "connected"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {conversation.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Agent is:</span>
          <span
            className={`px-2 py-1 rounded-md text-xs ${
              conversation.isSpeaking
                ? "bg-blue-100 text-blue-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {conversation.isSpeaking ? "speaking" : "listening"}
          </span>
        </div>
      </div>
    </div>
  );
}
