import React, { useState, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChiefConversation } from "@/hooks/useChiefConversation";
import { useCallTimer } from "@/hooks/useCallTimer";
import { ChiefLoadingIndicators } from "@/components/ChiefLoadingIndicators";
import { useAuth } from "@/hooks/useAuth";

const RealtimeVoiceChief = () => {
  const { user } = useAuth();
  const [showCaptions, setShowCaptions] = useState(false);

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

  const {
    callDuration,
    isCallActive,
    setIsCallActive,
    formatTime,
    resetTimer,
  } = useCallTimer();

  const handleCallAction = useCallback(async () => {
    if (conversation.status === "connected") {
      await stopConversation();
      setIsCallActive(false);
      resetTimer();
    } else {
      await startConversation();
      setIsCallActive(true);
      resetTimer();
    }
  }, [
    conversation.status,
    startConversation,
    stopConversation,
    setIsCallActive,
    resetTimer,
  ]);

  const getStatusText = () => {
    if (conversation.status === "disconnected")
      return "Tap to start conversation with Chief";
    if (conversation.status === "connecting") return "Connecting to Chief...";

    switch (conversation.isSpeaking ? "speaking" : "listening") {
      case "speaking":
        return "Chief is speaking...";
      case "listening":
        return "Chief is listening...";
      default:
        return "Conversation active";
    }
  };

  const userName =
    userFirstName ||
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden h-full flex flex-col">
      {/* Starfield background */}
      <div className="absolute inset-0 opacity-30 w-full h-full">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col h-full p-6">
        {/* Header */}
        <div className="text-center pt-8 mb-16">
          <h1 className="text-2xl font-medium text-white">
            {userName}'s Chief
          </h1>
        </div>

        {/* Central Avatar and Timer */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <div className="relative">
            <Avatar className="w-48 h-48 border-4 border-white/20">
              <AvatarFallback className="text-6xl bg-slate-800 text-white">
                🤖
              </AvatarFallback>
            </Avatar>
            {conversation.status === "connected" &&
              !conversation.isSpeaking && (
                <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-pulse" />
              )}
            {conversation.status === "connected" && conversation.isSpeaking && (
              <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-pulse" />
            )}
            {conversation.status === "connecting" && (
              <div className="absolute inset-0 rounded-full border-4 border-yellow-400 animate-pulse" />
            )}
          </div>

          <div className="text-center">
            {conversation.status !== "disconnected" && (
              <div className="text-4xl font-light text-white mb-2">
                {formatTime(callDuration)}
              </div>
            )}
            {/* <div className="text-center px-6 min-h-[60px] flex items-center justify-center">
              <p className="text-white/80 text-sm">{getStatusText()}</p>
            </div> */}
          </div>
        </div>

        {/* Loading indicators */}
        <ChiefLoadingIndicators
          isLoadingUserData={isLoadingUserData}
          isLoadingTools={isLoadingTools}
          userPreferences={userPreferences}
          userContacts={userContacts}
          availableTools={availableTools}
          className="mb-4"
        />

        {/* Bottom Controls */}
        <div className="pb-20">
          {conversation.status === "disconnected" ? (
            // Call button when disconnected
            <Button
              onClick={handleCallAction}
              disabled={!isReady}
              className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-medium rounded-full mb-4 disabled:bg-gray-600"
            >
              <Phone className="w-6 h-6 mr-3" />
              {!isReady ? "Loading..." : "Call Chief"}
            </Button>
          ) : (
            // In-call controls
            <div className="flex justify-center space-x-4 mb-4">
              <Button
                variant="outline"
                size="lg"
                className="w-14 h-14 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => setShowCaptions(!showCaptions)}
              >
                CC
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-14 h-14 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Volume2 className="w-6 h-6" />
              </Button>

              <Button
                onClick={handleCallAction}
                size="lg"
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeVoiceChief;
