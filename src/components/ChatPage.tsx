
import { useState } from "react";
import { ChiefInterface } from "@/components/ChiefInterface";
import { ChiefVoiceInterface } from "@/components/ChiefVoiceInterface";

const ChatPage = () => {
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  if (isVoiceMode) {
    return (
      <ChiefVoiceInterface 
        onTextToggle={() => setIsVoiceMode(false)}
      />
    );
  }

  return (
    <ChiefInterface 
      onVoiceToggle={() => setIsVoiceMode(true)}
      isVoiceMode={isVoiceMode}
    />
  );
};

export default ChatPage;
