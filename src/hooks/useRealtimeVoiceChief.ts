import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type ConversationState = "idle" | "listening" | "speaking" | "thinking";

export const useRealtimeVoiceChief = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [conversationState, setConversationState] = useState<ConversationState>("idle");
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const connect = useCallback(async () => {
    if (connectionState === "connected" || connectionState === "connecting") return;

    try {
      setConnectionState("connecting");
      console.log("🔌 Connecting to voice chief...");

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        await processAudio(audioBlob);
      };

      setConnectionState("connected");
      setConversationState("idle");

      toast({
        title: "Connected",
        description: "Voice chief is ready. Click to start recording!",
      });

    } catch (error) {
      console.error("❌ Connection error:", error);
      setConnectionState("error");
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect",
        variant: "destructive",
      });
    }
  }, [connectionState, toast]);

  const processAudio = async (audioBlob: Blob) => {
    try {
      setConversationState("thinking");
      
      // Convert audio to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      console.log("🎤 Transcribing audio...");
      
      // Step 1: Transcribe audio
      const transcribeResult = await supabase.functions.invoke('realtime-voice-chief', {
        body: {
          action: 'transcribe',
          audio: base64Audio
        }
      });

      if (transcribeResult.error) {
        throw new Error(transcribeResult.error.message);
      }

      const transcriptionText = transcribeResult.data.text;
      setCurrentTranscript(transcriptionText);
      console.log("✅ Transcription:", transcriptionText);

      if (!transcriptionText || transcriptionText.trim().length === 0) {
        setConversationState("idle");
        return;
      }

      // Step 2: Get AI response
      console.log("🤖 Getting AI response...");
      const chatResult = await supabase.functions.invoke('realtime-voice-chief', {
        body: {
          action: 'chat',
          text: transcriptionText
        }
      });

      if (chatResult.error) {
        throw new Error(chatResult.error.message);
      }

      const aiResponseText = chatResult.data.text;
      setAiResponse(aiResponseText);
      console.log("✅ AI Response:", aiResponseText);

      // Step 3: Convert AI response to speech
      console.log("🔊 Converting to speech...");
      setConversationState("speaking");
      
      const ttsResult = await supabase.functions.invoke('realtime-voice-chief', {
        body: {
          action: 'speak',
          text: aiResponseText
        }
      });

      if (ttsResult.error) {
        throw new Error(ttsResult.error.message);
      }

      // Play the audio
      const base64AudioResponse = ttsResult.data.audio;
      if (!base64AudioResponse) {
        throw new Error("No audio data received from TTS service");
      }
      
      try {
        const audioBuffer = Uint8Array.from(atob(base64AudioResponse), c => c.charCodeAt(0));
        const responseAudioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(responseAudioBlob);
        
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setConversationState("idle");
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
        console.log("✅ Audio playback started");
      } catch (audioError) {
        console.error("❌ Audio decoding/playback error:", audioError);
        throw new Error("Failed to decode or play audio response");
      }

    } catch (error) {
      console.error("❌ Processing error:", error);
      setConversationState("idle");
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : "Failed to process audio",
        variant: "destructive",
      });
    }
  };

  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current || connectionState !== "connected") return;
    
    // Check if already recording
    if (mediaRecorderRef.current.state === "recording") {
      console.log("🎤 Already recording, ignoring start request");
      return;
    }

    setConversationState("listening");
    setCurrentTranscript("");
    setAiResponse("");
    
    mediaRecorderRef.current.start();
    console.log("🎤 Recording started");
  }, [connectionState]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") return;

    mediaRecorderRef.current.stop();
    setConversationState("thinking");
    console.log("🎤 Recording stopped");
  }, []);

  const disconnect = useCallback(() => {
    console.log("🔌 Disconnecting from voice chief...");

    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      mediaRecorderRef.current = null;
    }

    setConnectionState("disconnected");
    setConversationState("idle");
    setCurrentTranscript("");
    setAiResponse("");

    toast({
      title: "Disconnected",
      description: "Voice chief session ended",
    });
  }, [toast]);

  const sendTextMessage = useCallback(async (text: string) => {
    if (connectionState !== "connected") return;

    try {
      setConversationState("thinking");
      setCurrentTranscript(text);

      // Get AI response
      const chatResult = await supabase.functions.invoke('realtime-voice-chief', {
        body: {
          action: 'chat',
          text: text
        }
      });

      if (chatResult.error) {
        throw new Error(chatResult.error.message);
      }

      const aiResponseText = chatResult.data.text;
      setAiResponse(aiResponseText);

      // Convert to speech and play
      setConversationState("speaking");
      
      const ttsResult = await supabase.functions.invoke('realtime-voice-chief', {
        body: {
          action: 'speak',
          text: aiResponseText
        }
      });

      if (ttsResult.error) {
        throw new Error(ttsResult.error.message);
      }

      const base64AudioResponse = ttsResult.data.audio;
      if (!base64AudioResponse) {
        throw new Error("No audio data received from TTS service");
      }
      
      try {
        const audioBuffer = Uint8Array.from(atob(base64AudioResponse), c => c.charCodeAt(0));
        const responseAudioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(responseAudioBlob);
        
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setConversationState("idle");
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } catch (audioError) {
        console.error("❌ Audio decoding/playback error:", audioError);
        throw new Error("Failed to decode or play audio response");
      }

    } catch (error) {
      console.error("❌ Text message error:", error);
      setConversationState("idle");
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process message",
        variant: "destructive",
      });
    }
  }, [connectionState, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    conversationState,
    currentTranscript,
    aiResponse,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
  };
};
