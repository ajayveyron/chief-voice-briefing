
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useUpdates } from '@/hooks/useUpdates';
import { useUserDocuments } from '@/hooks/useUserDocuments';

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
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { updates } = useUpdates();
  const { documents } = useUserDocuments();

  const addMessage = useCallback((text: string, type: 'user' | 'assistant') => {
    const message: VoiceChatMessage = {
      id: Date.now().toString(),
      text,
      type,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
    
    // Update conversation history
    setConversationHistory(prev => [
      ...prev,
      { role: type === 'user' ? 'user' : 'assistant', content: text }
    ]);
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
          noiseSuppression: true,
          autoGainControl: true
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

      // Auto-stop recording after 30 seconds to prevent overly long recordings
      setTimeout(() => {
        if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('⏰ Auto-stopping recording after 30 seconds');
          stopRecording();
        }
      }, 30000);

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
  }, [isRecording, toast]);

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
      
      // Step 1: Transcribe audio using Whisper
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

      // Step 2: Get AI response with enhanced context
      console.log('🤖 Getting AI response with context...');
      
      // Build conversation history for context
      const conversationMessages = conversationHistory.length > 0 
        ? [...conversationHistory, { role: 'user', content: userText }]
        : undefined;

      const chatResponse = await supabase.functions.invoke('chat-with-ai', {
        body: { 
          prompt: conversationMessages ? undefined : userText,
          messages: conversationMessages,
          userUpdates: updates,
          userDocuments: documents,
          customInstructions: localStorage.getItem('customInstructions') || ''
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
          console.log('🎵 Audio playback completed');
        };
        audioRef.current.onerror = () => {
          console.error('❌ Audio playback error');
          setVoiceState('idle');
          URL.revokeObjectURL(audioUrl);
        };
        await audioRef.current.play();
        console.log('🎵 Audio playback started');
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
  }, [addMessage, toast, conversationHistory, updates, documents]);

  const sendTextMessage = useCallback(async (text: string) => {
    try {
      setVoiceState('processing');
      addMessage(text, 'user');

      const conversationMessages = conversationHistory.length > 0 
        ? [...conversationHistory, { role: 'user', content: text }]
        : undefined;

      const chatResponse = await supabase.functions.invoke('chat-with-ai', {
        body: { 
          prompt: conversationMessages ? undefined : text,
          messages: conversationMessages,
          userUpdates: updates,
          userDocuments: documents,
          customInstructions: localStorage.getItem('customInstructions') || ''
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
  }, [addMessage, toast, conversationHistory, updates, documents]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    setVoiceState('idle');
    console.log('🔄 Conversation reset');
  }, []);

  return {
    voiceState,
    messages,
    isRecording,
    startRecording,
    stopRecording,
    sendTextMessage,
    resetConversation,
    audioRef
  };
};
