import React from "react";
import {
  Mic,
  Phone,
  PhoneOff,
  MessageCircle,
  Calendar,
  Mail,
  Send,
  User,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useRealtimeVoiceChief } from "@/hooks/useRealtimeVoiceChief";
import { Conversation } from "./Conversation";

const chatBubbles = [
  // Example chat bubbles, replace with real conversation state if available
  // { sender: 'chief', text: "Welcome! How can I help you today?" },
  // { sender: 'user', text: "What's on my calendar?" },
];

type QuickAction = {
  label: string;
  icon: React.ReactNode;
  action: (send: (msg: string) => void) => void;
};

const quickActions: QuickAction[] = [
  {
    label: "What's my day look like?",
    icon: <Calendar className="w-4 h-4 mr-2" />,
    action: (send) =>
      send(
        "What are my updates today? Please give me a summary of emails, calendar events, and any important notifications."
      ),
  },
  {
    label: "Schedule a meeting",
    icon: <Calendar className="w-4 h-4 mr-2" />,
    action: (send) =>
      send("I need to schedule a meeting. Can you help me with that?"),
  },
  {
    label: "Check emails",
    icon: <Mail className="w-4 h-4 mr-2" />,
    action: (send) =>
      send("Please check my recent emails and summarize anything important."),
  },
  {
    label: "Send an email",
    icon: <Send className="w-4 h-4 mr-2" />,
    action: (send) =>
      send("I need to send an email. Can you help me compose one?"),
  },
];

const RealtimeVoiceChief = () => {
  const {
    connectionState,
    conversationState,
    currentTranscript,
    aiResponse,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
  } = useRealtimeVoiceChief();

  const getStatusGlow = () => {
    switch (connectionState) {
      case "connected":
        switch (conversationState) {
          case "listening":
            return "shadow-[0_0_32px_8px_rgba(239,68,68,0.5)] animate-pulse";
          case "speaking":
            return "shadow-[0_0_32px_8px_rgba(59,130,246,0.5)] animate-pulse";
          case "thinking":
            return "shadow-[0_0_32px_8px_rgba(253,224,71,0.5)] animate-pulse";
          default:
            return "shadow-[0_0_24px_4px_rgba(34,197,94,0.3)]";
        }
      case "connecting":
        return "shadow-[0_0_32px_8px_rgba(253,224,71,0.5)] animate-pulse";
      case "error":
        return "shadow-[0_0_32px_8px_rgba(239,68,68,0.5)]";
      default:
        return "shadow-[0_0_16px_2px_rgba(156,163,175,0.2)]";
    }
  };

  const getStatusText = () => {
    if (connectionState === "disconnected")
      return "Tap to start conversation with Chief";
    if (connectionState === "connecting") return "Connecting to Chief...";
    if (connectionState === "error") return "Connection error - tap to retry";
    switch (conversationState) {
      case "listening":
        return "Chief is listening...";
      case "speaking":
        return "Chief is speaking...";
      case "thinking":
        return "Chief is thinking...";
      default:
        return "Connected • Say something to Chief";
    }
  };

  // Main action button
  const handleMainAction = () => {
    if (connectionState === "connected") {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f2027] via-[#2c5364] to-[#232526] p-4">
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 flex flex-col items-center p-8">
        {/* Header with Chief avatar and title */}
        <div className="flex flex-col items-center mb-8">
          <Avatar className="w-20 h-20 mb-2 border-4 border-white/30 bg-gray-900">
            <AvatarFallback className="text-4xl">👔</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Chief
          </h1>
          <p className="text-base text-gray-200 font-medium">
            Your AI Chief of Staff
          </p>
        </div>
        {/* Main Conversation UI */}
        <Conversation />
      </div>
    </div>
  );
};

export default RealtimeVoiceChief;
