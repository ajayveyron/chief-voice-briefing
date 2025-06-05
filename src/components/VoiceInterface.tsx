
import { useState } from "react";
import VoiceButton from "./VoiceButton";

type VoiceState = "idle" | "listening" | "speaking" | "processing";

const VoiceInterface = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [currentMessage, setCurrentMessage] = useState<string>("");

  const handleVoiceActivation = () => {
    if (voiceState === "idle") {
      setVoiceState("processing");
      // Simulate processing and then speaking
      setTimeout(() => {
        setCurrentMessage("You have three updates. First, a follow-up from yesterday's investor call. Want to hear it?");
        setVoiceState("speaking");
      }, 1000);
    } else if (voiceState === "speaking") {
      setVoiceState("listening");
    } else if (voiceState === "listening") {
      setVoiceState("processing");
      // Simulate processing response
      setTimeout(() => {
        setCurrentMessage("Got it. Moving to your next update...");
        setVoiceState("speaking");
      }, 800);
    }
  };

  const handleStop = () => {
    setVoiceState("idle");
    setCurrentMessage("");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-8">
      <div className="flex flex-col items-center space-y-8">
        {/* Status indicator */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light mb-2">Chief</h1>
          <p className="text-gray-400 text-sm">
            {voiceState === "idle" && "Tap to activate"}
            {voiceState === "processing" && "Processing..."}
            {voiceState === "listening" && "Listening..."}
            {voiceState === "speaking" && "Speaking"}
          </p>
        </div>

        {/* Central voice button */}
        <VoiceButton 
          state={voiceState} 
          onActivate={handleVoiceActivation}
          onStop={handleStop}
        />

        {/* Current message display */}
        {currentMessage && (
          <div className="max-w-md text-center mt-8">
            <p className="text-lg leading-relaxed text-gray-200">
              {currentMessage}
            </p>
          </div>
        )}

        {/* Voice commands help */}
        {voiceState === "speaking" && (
          <div className="text-center mt-6 text-sm text-gray-500">
            Say "Next", "Stop", "Repeat", or ask a follow-up
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceInterface;
