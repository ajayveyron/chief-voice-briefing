
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpdates } from "@/hooks/useUpdates";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import RealVoiceInterface from "./RealVoiceInterface";

const HomePage = () => {
  const { user } = useAuth();
  const { updates, loading } = useUpdates();
  const {
    connectionState,
    voiceState,
    messages,
    currentTranscript,
    connect,
    disconnect,
    sendTextMessage
  } = useRealtimeChat();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="flex flex-col items-center space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light mb-2">Chief</h1>
          <p className="text-gray-400 text-sm">
            AI Voice Assistant • {updates.length} updates available
          </p>
        </div>

        {/* Voice Interface */}
        <RealVoiceInterface
          connectionState={connectionState}
          voiceState={voiceState}
          onConnect={connect}
          onDisconnect={disconnect}
          currentTranscript={currentTranscript}
        />

        {/* Recent conversation */}
        {messages.length > 0 && (
          <div className="max-w-md w-full mt-8">
            <h3 className="text-sm text-gray-400 mb-3">Recent Conversation:</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {messages.slice(-3).map((message) => (
                <div 
                  key={message.id} 
                  className={`text-xs p-2 rounded ${
                    message.type === 'user' 
                      ? 'bg-blue-900/30 text-blue-200 ml-4' 
                      : 'bg-gray-800/50 text-gray-300 mr-4'
                  }`}
                >
                  <span className="font-medium">
                    {message.type === 'user' ? 'You' : 'Chief'}:
                  </span> {message.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Updates preview when idle */}
        {connectionState === 'disconnected' && updates.length > 0 && (
          <div className="mt-8 max-w-md">
            <h3 className="text-sm text-gray-400 mb-3">Recent Updates:</h3>
            <div className="space-y-2">
              {updates.slice(0, 3).map((update) => (
                <div key={update.id} className="text-xs text-gray-500 border-l-2 border-gray-700 pl-3">
                  <span className="text-gray-400">{update.integration_type}</span> • {update.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice commands help */}
        {connectionState === 'connected' && voiceState === 'idle' && (
          <div className="text-center mt-6 text-sm text-gray-500">
            Try saying: "What updates do I have?" or "Tell me about my notifications"
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
