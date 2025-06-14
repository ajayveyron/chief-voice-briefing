import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Mic, 
  MicOff, 
  Bot, 
  Volume2,
  VolumeX,
  MessageSquare
} from "lucide-react";
import { useRealtimeVoiceChief } from "@/hooks/useRealtimeVoiceChief";
import { cn } from "@/lib/utils";

interface ChiefVoiceInterfaceProps {
  onTextToggle?: () => void;
}

export const ChiefVoiceInterface: React.FC<ChiefVoiceInterfaceProps> = ({ 
  onTextToggle 
}) => {
  const {
    connectionState,
    conversationState,
    currentTranscript,
    aiResponse,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage
  } = useRealtimeVoiceChief();

  // Computed states based on hook values
  const isConnected = connectionState === "connected";
  const isListening = conversationState === "listening";
  const isSpeaking = conversationState === "speaking";
  const isError = connectionState === "error";

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Failed to connect to voice:', err);
    }
  };

  const handleStartRecording = () => {
    if (isConnected) {
      startRecording();
    } else {
      handleConnect();
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const getStatusText = () => {
    if (isError) return "Connection Error";
    if (connectionState === "connecting") return "Connecting...";
    if (isSpeaking) return "Chief is speaking...";
    if (isListening) return "Listening...";
    return "Ready to chat";
  };

  const getStatusColor = () => {
    if (isError) return "text-destructive";
    if (connectionState === "connecting") return "text-muted-foreground";
    if (isSpeaking) return "text-blue-500";
    if (isListening) return "text-emerald-500";
    return "text-foreground";
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Chief Voice</h1>
              <p className={cn("text-sm transition-colors", getStatusColor())}>
                {getStatusText()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            {onTextToggle && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTextToggle}
                className="flex items-center space-x-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Text</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Voice Interface */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
        {/* Central Microphone Button */}
        <div className="relative">
          <Button
            size="lg"
            variant={isListening ? "default" : "outline"}
            className={cn(
              "h-32 w-32 rounded-full transition-all duration-300",
              isListening && "shadow-lg shadow-primary/25 scale-105",
              isSpeaking && "animate-pulse"
            )}
            onClick={isListening ? handleStopRecording : handleStartRecording}
            disabled={connectionState === "connecting"}
          >
            {isListening ? (
              <div className="flex items-center justify-center">
                <MicOff className="h-12 w-12 animate-pulse" />
              </div>
            ) : (
              <Mic className="h-12 w-12" />
            )}
          </Button>
          
          {/* Speaking indicator */}
          {isSpeaking && (
            <div className="absolute -inset-4 rounded-full border-4 border-blue-500 animate-ping" />
          )}
          
          {/* Listening indicator */}
          {isListening && (
            <div className="absolute -inset-2 rounded-full border-2 border-emerald-500 animate-pulse" />
          )}
        </div>

        {/* Status Text */}
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            {isListening ? "I'm listening..." : isSpeaking ? "Chief is speaking" : "Tap to start"}
          </h2>
          <p className="text-muted-foreground">
            {isListening 
              ? "Speak naturally, I'll understand and take action"
              : isSpeaking 
              ? "I'm responding to your request"
              : "Start a voice conversation with Chief"
            }
          </p>
        </div>

        {/* Transcript Display */}
        {currentTranscript && (
          <Card className="w-full max-w-md">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">You said:</p>
              <p className="text-sm">{currentTranscript}</p>
            </CardContent>
          </Card>
        )}

        {/* Response Display */}
        {aiResponse && (
          <Card className="w-full max-w-md">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    <Bot className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-muted-foreground">Chief responded:</p>
              </div>
              <p className="text-sm">{aiResponse}</p>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {isError && (
          <Card className="w-full max-w-md border-destructive">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-destructive mb-2">Connection Error:</p>
              <p className="text-sm text-muted-foreground">Failed to connect to voice service</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleConnect}
                className="mt-2"
              >
                Retry Connection
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant={isConnected ? "destructive" : "default"}
            size="sm"
            onClick={isConnected ? disconnect : handleConnect}
            className="flex items-center space-x-2"
          >
            {isConnected ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>{isConnected ? "Disconnect" : "Connect"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};