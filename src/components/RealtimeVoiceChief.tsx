import React, { useState, useCallback, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChiefConversation } from "@/hooks/useChiefConversation";
import { useCallTimer } from "@/hooks/useCallTimer";
import { ChiefLoadingIndicators } from "@/components/ChiefLoadingIndicators";
import { useAuth } from "@/hooks/useAuth";
import { SoundEffects } from "@/utils/soundEffects";
import { useProximitySensor } from "@/hooks/useProximitySensor";
import { useAudioRouting } from "@/hooks/useAudioRouting";

const RealtimeVoiceChief = () => {
  const { user } = useAuth();
  const [showCaptions, setShowCaptions] = useState(false);

  // New hooks for proximity and audio routing
  const { isNearEar, setCallActive } = useProximitySensor();
  const { audioRoute, switchToEarpiece, switchToSpeaker, toggleAudioRoute } =
    useAudioRouting();

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
    // Microphone controls
    isMuted,
    toggleMute,
    microphoneSupported,
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
      // Play call end sound
      await SoundEffects.playCallEnd();
      await stopConversation();
      setIsCallActive(false);
      resetTimer();
    } else {
      // Play call start sound
      await SoundEffects.playCallStart();
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

  // Track previous status for sound effects
  const previousStatusRef = useRef(conversation.status);

  // Initialize sound effects on component mount
  useEffect(() => {
    SoundEffects.initialize();
  }, []);

  // Play sound effects for status changes
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const currentStatus = conversation.status;

    // Only play sounds when status actually changes
    if (previousStatus !== currentStatus) {
      if (currentStatus === "connecting") {
        SoundEffects.playConnection();
      } else if (
        currentStatus === "connected" &&
        previousStatus === "connecting"
      ) {
        SoundEffects.playSuccess();
      } else if (
        currentStatus === "disconnected" &&
        previousStatus === "connected"
      ) {
        SoundEffects.playDisconnect();
      }
    }

    previousStatusRef.current = currentStatus;
  }, [conversation.status]);

  // Manage call state for proximity detection
  useEffect(() => {
    const isCallActive = conversation.status === "connected";
    setCallActive(isCallActive);
  }, [conversation.status, setCallActive]);

  // Handle screen dimming when phone is near ear
  useEffect(() => {
    if (isNearEar && conversation.status === "connected") {
      document.body.className =
        document.body.className.replace("proximity-normal", "") +
        " proximity-dimmed";
    } else {
      document.body.className =
        document.body.className.replace("proximity-dimmed", "") +
        " proximity-normal";
    }

    // Cleanup on unmount
    return () => {
      document.body.className = document.body.className
        .replace("proximity-dimmed", "")
        .replace("proximity-normal", "");
    };
  }, [isNearEar, conversation.status]);

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
          {/* <div className="flex items-center justify-center mt-2">
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-1 bg-white/60 rounded-full animate-pulse"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div> */}
            {/* <span className="text-xs text-white/60 ml-2">
              Sound Effects Enabled
            </span>*/}
          </div> 

          {/* Proximity and Audio Route Indicators */}
          {/* <div className="flex items-center justify-center mt-3 space-x-4">
            {isNearEar && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">Near Ear</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  audioRoute === "speaker" ? "bg-blue-400" : "bg-gray-400"
                }`}
              ></div>
              <span className="text-xs text-white/60">
                {audioRoute === "speaker" ? "Speaker" : "Earpiece"}
              </span>
            </div>

            {microphoneSupported && (
              <div className="flex items-center space-x-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isMuted ? "bg-red-400" : "bg-green-400"
                  }`}
                ></div>
                <span className="text-xs text-white/60">
                  {isMuted ? "Muted" : "Live"}
                </span>
              </div>
            )}
          </div>
        </div> */}

        {/* Central Avatar and Timer */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <div className="relative">
            <Avatar className="w-48 h-48 border-4 border-white/20">
              <AvatarFallback className="text-6xl bg-slate-800 text-white">
                🤖
              </AvatarFallback>
            </Avatar>
            {conversation.status === "connected" && isMuted && (
              <div className="absolute inset-0 rounded-full border-4 border-gray-400 animate-pulse" />
            )}
            {conversation.status === "connected" &&
              !conversation.isSpeaking &&
              !isMuted && (
                <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-pulse" />
              )}
            {conversation.status === "connected" &&
              conversation.isSpeaking &&
              !isMuted && (
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
              onClick={async () => {
                if (!isReady) {
                  await SoundEffects.playError();
                  return;
                }
                await handleCallAction();
              }}
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
                onClick={async () => {
                  await SoundEffects.playCaptionToggle();
                  setShowCaptions(!showCaptions);
                }}
              >
                CC
              </Button>

              <Button
                variant="outline"
                size="lg"
                className={`w-14 h-14 rounded-full border-white/20 text-white hover:bg-white/20 ${
                  isMuted ? "bg-red-500/20" : "bg-white/10"
                }`}
                onClick={async () => {
                  await SoundEffects.playMuteToggle();
                  toggleMute();
                }}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </Button>

              <Button
                variant="outline"
                size="lg"
                className={`w-14 h-14 rounded-full border-white/20 text-white hover:bg-white/20 ${
                  audioRoute === "speaker"
                    ? "audio-route-speaker"
                    : "audio-route-earpiece"
                }`}
                onClick={async () => {
                  await toggleAudioRoute();
                  await SoundEffects.playVolumeChange();
                }}
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
