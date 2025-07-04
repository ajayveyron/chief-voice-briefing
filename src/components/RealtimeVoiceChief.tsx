import React, { useState, useEffect } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRealtimeVoiceChief } from "@/hooks/useRealtimeVoiceChief";
import { useAuth } from "@/hooks/useAuth";


const RealtimeVoiceChief = () => {
  const { user } = useAuth();
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const {
    connectionState,
    conversationState,
    currentTranscript,
    connect,
    disconnect,
  } = useRealtimeVoiceChief();

  // Timer effect for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCallAction = () => {
    if (connectionState === "connected") {
      disconnect();
      setIsCallActive(false);
      setCallDuration(0);
    } else {
      connect();
      setIsCallActive(true);
    }
  };

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Starfield background */}
      <div className="absolute inset-0 opacity-30">
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

      <div className="relative z-10 flex flex-col h-screen p-6">
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
            {connectionState === "connected" && (
              <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-pulse" />
            )}
          </div>

          <div className="text-center">
            <div className="text-4xl font-light text-white mb-2">
              {formatTime(callDuration)}
            </div>
            {connectionState === "connected" && currentTranscript && (
              <div className="text-center px-6">
                <p className="text-white/80 text-sm">
                  This is an example of live captions during the call.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="pb-20">
          {connectionState === "disconnected" ? (
            // Call button when disconnected
            <Button
              onClick={handleCallAction}
              className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-medium rounded-full mb-4"
            >
              <Phone className="w-6 h-6 mr-3" />
              Call Chief
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
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
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
