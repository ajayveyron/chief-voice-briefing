
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

interface VoiceChatMessage {
  id: string;
  text: string;
  type: 'user' | 'assistant';
  timestamp: Date;
}

export const useVoiceChat = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const addMessage = useCallback((text: string, type: 'user' | 'assistant') => {
    const message: VoiceChatMessage = {
      id: Date.now().toString(),
      text,
      type,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting voice recording...');
      setVoiceState('recording');
      setIsRecording(true);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log('🛑 Recording stopped, processing...');
        setVoiceState('processing');
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAndRespond(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      console.log('✅ Recording started');

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setVoiceState('idle');
      setIsRecording(false);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('🔴 Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAndRespond = useCallback(async (audioBlob: Blob) => {
    try {
      // Convert audio to base64
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(audioBlob);
      });

      console.log('📤 Sending audio for transcription...');
      
      // Step 1: Transcribe audio
      const transcriptionResponse = await supabase.functions.invoke('voice-to-text', {
        body: { audio: audioBase64 }
      });

      if (transcriptionResponse.error) {
        throw new Error(transcriptionResponse.error.message);
      }

      const { text: userText } = transcriptionResponse.data;
      console.log('📝 Transcription:', userText);
      
      if (!userText || userText.trim().length === 0) {
        setVoiceState('idle');
        toast({
          title: "No Speech Detected",
          description: "Please try speaking more clearly.",
        });
        return;
      }

      addMessage(userText, 'user');

      // Step 2: Get AI response
      console.log('🤖 Getting AI response...');
      const chatResponse = await supabase.functions.invoke('chat-with-ai', {
        body: { 
          prompt: `You are Chief, an AI assistant that helps users manage their notifications and updates. Be helpful, conversational, and keep responses concise for voice conversation. User said: "${userText}"` 
        }
      });

      if (chatResponse.error) {
        throw new Error(chatResponse.error.message);
      }

      const { generatedText: assistantText } = chatResponse.data;
      console.log('💭 AI response:', assistantText);
      addMessage(assistantText, 'assistant');

      // Step 3: Convert response to speech
      console.log('🔊 Converting to speech...');
      setVoiceState('speaking');
      
      const ttsResponse = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: assistantText,
          voice: 'alloy'
        }
      });

      if (ttsResponse.error) {
        throw new Error(ttsResponse.error.message);
      }

      const { audioContent } = ttsResponse.data;
      
      // Play the audio
      const audioData = atob(audioContent);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      
      const audioBlob2 = new Blob([audioArray], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob2);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setVoiceState('idle');
          URL.revokeObjectURL(audioUrl);
        };
        await audioRef.current.play();
      }

    } catch (error) {
      console.error('❌ Error in transcribe and respond:', error);
      setVoiceState('idle');
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : 'Failed to process voice input',
        variant: "destructive",
      });
    }
  }, [addMessage, toast]);

  const sendTextMessage = useCallback(async (text: string) => {
    try {
      setVoiceState('processing');
      addMessage(text, 'user');

      const chatResponse = await supabase.functions.invoke('chat-with-ai', {
        body: { 
          prompt: `You are Chief, an AI assistant that helps users manage their notifications and updates. Be helpful, conversational, and keep responses concise. User said: "${text}"` 
        }
      });

      if (chatResponse.error) {
        throw new Error(chatResponse.error.message);
      }

      const { generatedText: assistantText } = chatResponse.data;
      addMessage(assistantText, 'assistant');
      setVoiceState('idle');

    } catch (error) {
      console.error('❌ Error sending text message:', error);
      setVoiceState('idle');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: "destructive",
      });
    }
  }, [addMessage, toast]);

  return {
    voiceState,
    messages,
    isRecording,
    startRecording,
    stopRecording,
    sendTextMessage,
    audioRef
  };
};
