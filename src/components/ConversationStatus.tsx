import React from "react";

interface ConversationStatusProps {
  status: string;
  isSpeaking: boolean;
  className?: string;
}

export const ConversationStatus: React.FC<ConversationStatusProps> = ({
  status,
  isSpeaking,
  className = "",
}) => {
  const getStatusText = () => {
    if (status === "disconnected")
      return "Tap to start conversation with Chief";
    if (status === "connecting") return "Connecting to Chief...";

    switch (isSpeaking ? "speaking" : "listening") {
      case "speaking":
        return "Chief is speaking...";
      case "listening":
        return "Chief is listening...";
      default:
        return "Conversation active";
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <p>Status: {status}</p>
      <p>Agent is {isSpeaking ? "speaking" : "listening"}</p>
      <div className="text-center px-6 min-h-[60px] flex items-center justify-center">
        <p className="text-white/80 text-sm">{getStatusText()}</p>
      </div>
    </div>
  );
};
