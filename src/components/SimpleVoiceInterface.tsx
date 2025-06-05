
import { Mic, MicOff, Square, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

interface SimpleVoiceInterfaceProps {
  voiceState: VoiceState;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSendText: (text: string) => void;
}

const SimpleVoiceInterface = ({ 
  voiceState, 
  isRecording,
  onStartRecording, 
  onStopRecording,
  onSendText
}: SimpleVoiceInterfaceProps) => {
  const [textInput, setTextInput] = useState('');

  const getButtonClass = () => {
    const baseClass = "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95";
    
    switch (voiceState) {
      case "idle":
        return `${baseClass} bg-white text-black hover:bg-gray-100`;
      case "processing":
        return `${baseClass} bg-yellow-500 text-white animate-pulse`;
      case "recording":
        return `${baseClass} bg-red-500 text-white animate-pulse`;
      case "speaking":
        return `${baseClass} bg-blue-500 text-white`;
      default:
        return `${baseClass} bg-white text-black`;
    }
  };

  const getIcon = () => {
    switch (voiceState) {
      case "idle":
        return <Mic size={32} />;
      case "processing":
        return <Mic size={32} />;
      case "recording":
        return <MicOff size={32} />;
      case "speaking":
        return <Square size={32} />;
      default:
        return <Mic size={32} />;
    }
  };

  const getStatusText = () => {
    switch (voiceState) {
      case "idle":
        return "Tap to start recording";
      case "processing":
        return "Processing your request...";
      case "recording":
        return "Recording... Tap to stop";
      case "speaking":
        return "Chief is speaking...";
      default:
        return "Ready";
    }
  };

  const handleVoiceClick = () => {
    if (isRecording) {
      onStopRecording();
    } else if (voiceState === 'idle') {
      onStartRecording();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && voiceState === 'idle') {
      onSendText(textInput.trim());
      setTextInput('');
    }
  };

  const isDisabled = voiceState === 'processing' || voiceState === 'speaking';

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
        onClick={handleVoiceClick}
        className={getButtonClass()}
        disabled={isDisabled}
      >
        {getIcon()}
      </button>

      {/* Text input */}
      <form onSubmit={handleTextSubmit} className="flex gap-2 w-full max-w-md">
        <Input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Or type your message..."
          disabled={voiceState !== 'idle'}
          className="bg-gray-800 border-gray-600 text-white"
        />
        <Button
          type="submit"
          disabled={!textInput.trim() || voiceState !== 'idle'}
          size="sm"
        >
          <Send size={16} />
        </Button>
      </form>

      {/* Hidden audio element */}
      <audio style={{ display: 'none' }} />
    </div>
  );
};

export default SimpleVoiceInterface;
