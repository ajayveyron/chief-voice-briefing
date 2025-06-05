
import { Mic, MicOff, Square, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type VoiceState = 'idle' | 'listening' | 'speaking' | 'processing';

interface RealVoiceInterfaceProps {
  connectionState: ConnectionState;
  voiceState: VoiceState;
  onConnect: () => void;
  onDisconnect: () => void;
  currentTranscript?: string;
}

const RealVoiceInterface = ({ 
  connectionState, 
  voiceState, 
  onConnect, 
  onDisconnect,
  currentTranscript 
}: RealVoiceInterfaceProps) => {
  const getButtonClass = () => {
    const baseClass = "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95";
    
    if (connectionState === 'disconnected') {
      return `${baseClass} bg-white text-black hover:bg-gray-100`;
    }
    
    if (connectionState === 'connecting') {
      return `${baseClass} bg-yellow-500 text-white animate-pulse`;
    }
    
    if (connectionState === 'error') {
      return `${baseClass} bg-red-500 text-white`;
    }
    
    switch (voiceState) {
      case "idle":
        return `${baseClass} bg-green-500 text-white hover:bg-green-600`;
      case "processing":
        return `${baseClass} bg-yellow-500 text-white animate-pulse`;
      case "listening":
        return `${baseClass} bg-red-500 text-white animate-pulse`;
      case "speaking":
        return `${baseClass} bg-blue-500 text-white`;
      default:
        return `${baseClass} bg-white text-black`;
    }
  };

  const getIcon = () => {
    if (connectionState === 'disconnected') {
      return <Phone size={32} />;
    }
    
    if (connectionState === 'connecting') {
      return <Phone size={32} />;
    }
    
    if (connectionState === 'error') {
      return <PhoneOff size={32} />;
    }
    
    switch (voiceState) {
      case "idle":
        return <Mic size={32} />;
      case "processing":
        return <Mic size={32} />;
      case "listening":
        return <MicOff size={32} />;
      case "speaking":
        return <Square size={32} />;
      default:
        return <Mic size={32} />;
    }
  };

  const getStatusText = () => {
    if (connectionState === 'disconnected') {
      return "Tap to start voice conversation";
    }
    
    if (connectionState === 'connecting') {
      return "Connecting to voice service...";
    }
    
    if (connectionState === 'error') {
      return "Connection error - tap to retry";
    }
    
    switch (voiceState) {
      case "idle":
        return "Connected • Listening for speech";
      case "processing":
        return "Processing...";
      case "listening":
        return "Listening to you speak...";
      case "speaking":
        return "Chief is speaking...";
      default:
        return "Ready";
    }
  };

  const handleClick = () => {
    if (connectionState === 'connected') {
      onDisconnect();
    } else {
      onConnect();
    }
  };

  const isDisabled = connectionState === 'connecting';

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Status text */}
      <div className="text-center">
        <p className="text-gray-400 text-sm">
          {getStatusText()}
        </p>
      </div>

      {/* Voice button */}
      <button
        onClick={handleClick}
        className={getButtonClass()}
        disabled={isDisabled}
      >
        {getIcon()}
      </button>

      {/* Current transcript display */}
      {currentTranscript && (
        <div className="max-w-md text-center">
          <p className="text-sm text-gray-300 italic">
            "{currentTranscript}"
          </p>
        </div>
      )}

      {/* Disconnect button when connected */}
      {connectionState === 'connected' && (
        <Button 
          onClick={onDisconnect}
          variant="outline"
          size="sm"
          className="mt-4"
        >
          <PhoneOff size={16} className="mr-2" />
          End Conversation
        </Button>
      )}
    </div>
  );
};

export default RealVoiceInterface;
