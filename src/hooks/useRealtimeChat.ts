
import { useState, useRef, useCallback } from 'react';
import { AudioRecorder, encodeAudioForAPI, playAudioData, clearAudioQueue } from '@/utils/audioUtils';
import { useToast } from '@/components/ui/use-toast';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type VoiceState = 'idle' | 'listening' | 'speaking' | 'processing';

interface RealtimeMessage {
  id: string;
  text: string;
  type: 'user' | 'assistant';
  timestamp: Date;
}

export const useRealtimeChat = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();

  const addMessage = useCallback((text: string, type: 'user' | 'assistant') => {
    const message: RealtimeMessage = {
      id: Date.now().toString(),
      text,
      type,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  }, []);

  const connect = useCallback(async () => {
    if (connectionState === 'connected' || connectionState === 'connecting') return;

    try {
      setConnectionState('connecting');
      setVoiceState('processing');

      // Initialize audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect to WebSocket using the correct Supabase Edge Function format
      const wsUrl = `wss://xxccvppbxnhowncdhvdi.functions.supabase.co/realtime-chat`;
      console.log('Connecting to WebSocket:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionState('connected');
        setVoiceState('idle');
        toast({
          title: "Connected",
          description: "Voice interface is ready",
        });
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message:', data.type);

        switch (data.type) {
          case 'session.created':
            console.log('Session created');
            break;

          case 'session.updated':
            console.log('Session updated');
            break;

          case 'input_audio_buffer.speech_started':
            console.log('Speech started');
            setVoiceState('listening');
            break;

          case 'input_audio_buffer.speech_stopped':
            console.log('Speech stopped');
            setVoiceState('processing');
            break;

          case 'response.created':
            console.log('Response created');
            setCurrentTranscript('');
            break;

          case 'response.audio.delta':
            setVoiceState('speaking');
            if (data.delta && audioContextRef.current) {
              const binaryString = atob(data.delta);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              await playAudioData(audioContextRef.current, bytes);
            }
            break;

          case 'response.audio_transcript.delta':
            if (data.delta) {
              setCurrentTranscript(prev => prev + data.delta);
            }
            break;

          case 'response.audio_transcript.done':
            if (data.transcript) {
              addMessage(data.transcript, 'assistant');
              setCurrentTranscript('');
            }
            break;

          case 'response.audio.done':
            setVoiceState('idle');
            break;

          case 'input_audio_buffer.committed':
            console.log('Audio buffer committed');
            break;

          case 'conversation.item.input_audio_transcription.completed':
            if (data.transcript) {
              addMessage(data.transcript, 'user');
            }
            break;

          case 'error':
            console.error('Realtime API error:', data);
            toast({
              title: "Error",
              description: data.error?.message || 'An error occurred',
              variant: "destructive",
            });
            break;
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionState('disconnected');
        setVoiceState('idle');
        cleanup();
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
        setVoiceState('idle');
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice service",
          variant: "destructive",
        });
      };

      // Start audio recording
      audioRecorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const base64Audio = encodeAudioForAPI(audioData);
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          }));
        }
      });

      await audioRecorderRef.current.start();

    } catch (error) {
      console.error('Error connecting:', error);
      setConnectionState('error');
      setVoiceState('idle');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: "destructive",
      });
    }
  }, [connectionState, toast, addMessage]);

  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState('disconnected');
    setVoiceState('idle');
    setMessages([]);
    setCurrentTranscript('');
  }, []);

  const cleanup = useCallback(() => {
    audioRecorderRef.current?.stop();
    audioRecorderRef.current = null;
    
    wsRef.current?.close();
    wsRef.current = null;
    
    audioContextRef.current?.close();
    audioContextRef.current = null;
    
    clearAudioQueue();
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const event = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text
            }
          ]
        }
      };

      wsRef.current.send(JSON.stringify(event));
      wsRef.current.send(JSON.stringify({ type: 'response.create' }));
      addMessage(text, 'user');
    }
  }, [addMessage]);

  return {
    connectionState,
    voiceState,
    messages,
    currentTranscript,
    connect,
    disconnect,
    sendTextMessage
  };
};
