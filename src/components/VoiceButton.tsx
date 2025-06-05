
import { Mic, MicOff, Square } from "lucide-react";

type VoiceState = "idle" | "listening" | "speaking" | "processing";

interface VoiceButtonProps {
  state: VoiceState;
  onActivate: () => void;
  onStop: () => void;
}

const VoiceButton = ({ state, onActivate, onStop }: VoiceButtonProps) => {
  const getButtonClass = () => {
    const baseClass = "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95";
    
    switch (state) {
      case "idle":
        return `${baseClass} bg-white text-black hover:bg-gray-100`;
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
    switch (state) {
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

  const handleClick = () => {
    if (state === "speaking" || state === "listening") {
      onStop();
    } else {
      onActivate();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={getButtonClass()}
      disabled={state === "processing"}
    >
      {getIcon()}
    </button>
  );
};

export default VoiceButton;
