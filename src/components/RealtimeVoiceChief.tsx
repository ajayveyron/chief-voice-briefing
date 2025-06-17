
import React from 'react';
import { Mic, MicOff, Phone, PhoneOff, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealtimeVoiceChief } from '@/hooks/useRealtimeVoiceChief';

import { Conversation } from '@/components/Conversation';

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
    sendTextMessage
  } = useRealtimeVoiceChief();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        switch (conversationState) {
          case 'listening': return 'bg-red-500';
          case 'speaking': return 'bg-blue-500';
          case 'thinking': return 'bg-yellow-500';
          default: return 'bg-green-500';
        }
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (connectionState === 'disconnected') return "Tap to start conversation with Chief";
    if (connectionState === 'connecting') return "Connecting to Chief...";
    if (connectionState === 'error') return "Connection error - tap to retry";
    
    switch (conversationState) {
      case 'listening': return "Chief is listening...";
      case 'speaking': return "Chief is speaking...";
      case 'thinking': return "Chief is thinking...";
      default: return "Connected • Say something to Chief";
    }
  };

  const getIcon = () => {
    if (connectionState === 'disconnected') return <Phone size={32} />;
    if (connectionState === 'connecting') return <Phone size={32} />;
    if (connectionState === 'error') return <PhoneOff size={32} />;
    
    switch (conversationState) {
      case 'listening': return <Mic size={32} className="animate-pulse" />;
      case 'speaking': return <MessageCircle size={32} className="animate-pulse" />;
      case 'thinking': return <Mic size={32} className="animate-bounce" />;
      default: return <Mic size={32} />;
    }
  };

  const handleMainAction = () => {
    if (connectionState === 'connected') {
      disconnect();
    } else {
      connect();
    }
  };

  const quickActions = [
    { label: "What's my day look like?", action: () => sendTextMessage("What are my updates today? Please give me a summary of emails, calendar events, and any important notifications.") },
    { label: "Schedule a meeting", action: () => sendTextMessage("I need to schedule a meeting. Can you help me with that?") },
    { label: "Check emails", action: () => sendTextMessage("Please check my recent emails and summarize anything important.") },
    { label: "Send an email", action: () => sendTextMessage("I need to send an email. Can you help me compose one?") }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex flex-col items-center justify-center p-8">

      <Conversation />
      <div className="flex flex-col items-center space-y-8 max-w-md w-full">
        
        {/* Chief Avatar and Status */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className={`w-32 h-32 rounded-full ${getStatusColor()} flex items-center justify-center transition-all duration-300`}>
              <div className="w-28 h-28 bg-gray-800 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">👔</span>
              </div>
            </div>
            {connectionState === 'connected' && (
              <div className={`absolute -bottom-2 -right-2 w-8 h-8 ${getStatusColor()} rounded-full border-4 border-gray-900`}></div>
            )}
          </div>
          
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white">Chief</h1>
            <p className="text-sm text-gray-400">Your AI Chief of Staff</p>
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center">
          <p className="text-gray-300 text-sm">
            {getStatusText()}
          </p>
          {currentTranscript && (
            <p className="text-xs text-blue-300 mt-2 italic">
              "{currentTranscript}"
            </p>
          )}
        </div>

         {/* Recording Controls */}
         {connectionState === 'connected' && (
           <div className="flex gap-4">
             <button
               onMouseDown={startRecording}
               onMouseUp={stopRecording}
               onTouchStart={startRecording}
               onTouchEnd={stopRecording}
               disabled={conversationState === 'speaking' || conversationState === 'thinking'}
               className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                 conversationState === 'listening' ? 'bg-red-500' : 'bg-blue-500'
               } text-white disabled:opacity-50`}
             >
               {conversationState === 'listening' ? (
                 <Mic size={32} className="animate-pulse" />
               ) : (
                 <Mic size={32} />
               )}
             </button>
           </div>
         )}

         {/* Main Action Button - Only for connecting/disconnecting */}
         {connectionState !== 'connected' && (
           <button
             onClick={handleMainAction}
             disabled={connectionState === 'connecting'}
             className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${getStatusColor()} text-white disabled:opacity-50`}
           >
             {getIcon()}
           </button>
         )}

         {/* AI Response Display */}
         {aiResponse && connectionState === 'connected' && (
           <div className="w-full bg-gray-800/50 rounded-lg p-4 mt-4">
             <p className="text-sm text-gray-400 mb-2">Chief's Response:</p>
             <p className="text-white text-sm">{aiResponse}</p>
           </div>
         )}

        {/* Quick Actions */}
        {connectionState === 'connected' && (
          <div className="w-full space-y-3">
            <p className="text-sm text-gray-400 text-center">Quick Actions:</p>
            <div className="grid grid-cols-1 gap-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  onClick={action.action}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Connection Controls */}
        {connectionState === 'connected' && (
          <Button 
            onClick={disconnect}
            variant="destructive"
            size="sm"
            className="mt-4"
          >
            <PhoneOff size={16} className="mr-2" />
            End Conversation
          </Button>
        )}

        {/* Tips */}
        {connectionState === 'disconnected' && (
          <div className="text-center text-xs text-gray-500 mt-4 max-w-sm">
            <p>💡 <strong>Pro tip:</strong> Once connected, hold down the microphone button to record your message. Chief will transcribe, respond, and speak back to you!</p>
          </div>
        )}
        
        {connectionState === 'connected' && conversationState === 'idle' && (
          <div className="text-center text-xs text-gray-500 mt-4 max-w-sm">
            <p>🎤 <strong>Hold down</strong> the microphone button for at least half a second to record your message, or use the quick actions above.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealtimeVoiceChief;
