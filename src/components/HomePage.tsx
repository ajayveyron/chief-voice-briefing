
import { useAuth } from "@/hooks/useAuth";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Speaker } from "lucide-react";
import { useState, useEffect } from "react";

const HomePage = () => {
  const { user } = useAuth();
  const {
    voiceState,
    isRecording,
    startRecording,
    stopRecording,
    audioRef
  } = useVoiceChat();
  
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [isCallConnected]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCallStart = () => {
    setIsCallConnected(true);
    startRecording();
  };

  const handleCallEnd = () => {
    setIsCallConnected(false);
    setCallDuration(0);
    setIsMuted(false);
    if (isRecording) {
      stopRecording();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-8 max-w-sm w-full">
        
        {/* Avatar and Name */}
        <div className="flex flex-col items-center space-y-4">
          <Avatar className="w-32 h-32">
            <AvatarImage src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400" />
            <AvatarFallback className="text-2xl bg-muted text-foreground">Chief</AvatarFallback>
          </Avatar>
          
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white">Chief</h1>
            <p className="text-sm text-gray-400">Virtual Assistant</p>
          </div>
        </div>

        {/* Call Status */}
        <div className="text-center space-y-2">
          {isCallConnected ? (
            <>
              <p className="text-sm text-gray-400">Call in progress</p>
              <p className="text-lg font-mono text-white">{formatDuration(callDuration)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Tap to start voice conversation</p>
          )}
        </div>

        {/* Call Controls */}
        <div className="flex flex-col items-center space-y-6">
          {!isCallConnected ? (
            /* Call Button - Not Connected */
            <Button
              onClick={handleCallStart}
              className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 text-white"
              size="icon"
            >
              <Phone size={32} />
            </Button>
          ) : (
            /* Call Controls - Connected */
            <div className="flex items-center space-x-6">
              {/* Mute Button */}
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "outline"}
                className={`w-14 h-14 rounded-full ${isMuted ? '' : 'border-gray-600 text-white hover:bg-gray-800'}`}
                size="icon"
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </Button>

              {/* End Call Button */}
              <Button
                onClick={handleCallEnd}
                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white"
                size="icon"
              >
                <PhoneOff size={32} />
              </Button>

              {/* Speaker Button */}
              <Button
                onClick={toggleSpeaker}
                variant={isSpeakerOn ? "default" : "outline"}
                className={`w-14 h-14 rounded-full ${isSpeakerOn ? 'bg-white text-black' : 'border-gray-600 text-white hover:bg-gray-800'}`}
                size="icon"
              >
                <Speaker size={24} />
              </Button>
            </div>
          )}
        </div>

        {/* Voice State Indicator */}
        {isCallConnected && (
          <div className="text-center">
            <p className="text-xs text-gray-400">
              {voiceState === 'recording' && 'Listening...'}
              {voiceState === 'processing' && 'Processing...'}
              {voiceState === 'speaking' && 'Chief is speaking...'}
              {voiceState === 'idle' && 'Ready to listen'}
            </p>
          </div>
        )}

        {/* Hidden audio element for playback */}
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default HomePage;
