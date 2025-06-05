
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpdates } from "@/hooks/useUpdates";
import VoiceButton from "./VoiceButton";
import { useToast } from "@/components/ui/use-toast";

type VoiceState = "idle" | "listening" | "speaking" | "processing";

const VoiceInterface = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [currentUpdateIndex, setCurrentUpdateIndex] = useState(0);
  
  const { user, signOut } = useAuth();
  const { updates, loading, markAsRead } = useUpdates();
  const { toast } = useToast();

  const handleVoiceActivation = () => {
    if (voiceState === "idle") {
      if (updates.length === 0) {
        setVoiceState("processing");
        setTimeout(() => {
          setCurrentMessage("You're all caught up! No new updates at the moment.");
          setVoiceState("speaking");
        }, 1000);
        return;
      }

      setVoiceState("processing");
      setTimeout(() => {
        const update = updates[currentUpdateIndex];
        setCurrentMessage(`You have ${updates.length} updates. ${update.title}: ${update.summary}`);
        setVoiceState("speaking");
      }, 1000);
    } else if (voiceState === "speaking") {
      setVoiceState("listening");
    } else if (voiceState === "listening") {
      // Simulate processing user response
      setVoiceState("processing");
      setTimeout(() => {
        const currentUpdate = updates[currentUpdateIndex];
        
        // Mark current update as read
        if (currentUpdate) {
          markAsRead(currentUpdate.id);
        }

        // Move to next update or finish
        if (currentUpdateIndex < updates.length - 1) {
          const nextIndex = currentUpdateIndex + 1;
          setCurrentUpdateIndex(nextIndex);
          const nextUpdate = updates[nextIndex];
          setCurrentMessage(`Next update: ${nextUpdate.title}: ${nextUpdate.summary}`);
          setVoiceState("speaking");
        } else {
          setCurrentMessage("That's all your updates. You're now caught up!");
          setVoiceState("speaking");
          setTimeout(() => {
            handleStop();
          }, 3000);
        }
      }, 800);
    }
  };

  const handleStop = () => {
    setVoiceState("idle");
    setCurrentMessage("");
    setCurrentUpdateIndex(0);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-8">
      {/* User info and sign out */}
      <div className="absolute top-4 right-4">
        <button
          onClick={handleSignOut}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Sign out ({user?.email})
        </button>
      </div>

      <div className="flex flex-col items-center space-y-8">
        {/* Status indicator */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light mb-2">Chief</h1>
          <p className="text-gray-400 text-sm">
            {voiceState === "idle" && `${updates.length} updates available • Tap to activate`}
            {voiceState === "processing" && "Processing..."}
            {voiceState === "listening" && "Listening..."}
            {voiceState === "speaking" && `Update ${currentUpdateIndex + 1} of ${updates.length}`}
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

        {/* Updates preview when idle */}
        {voiceState === "idle" && updates.length > 0 && (
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
      </div>
    </div>
  );
};

export default VoiceInterface;
