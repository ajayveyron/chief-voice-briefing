
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up all resources...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    audioRecorderRef.current?.stop();
    audioRecorderRef.current = null;
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    audioContextRef.current?.close();
    audioContextRef.current = null;
    
    clearAudioQueue();
  }, []);

  const connect = useCallback(async () => {
    if (connectionState === 'connected' || connectionState === 'connecting') {
      console.log('⚠️ Already connected or connecting, ignoring request');
      return;
    }

    try {
      setConnectionState('connecting');
      setVoiceState('processing');

      console.log('🚀 Starting connection process...');

      // Initialize audio context first
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      await audioContextRef.current.resume(); // Ensure it's not suspended
      console.log('🎵 Audio context initialized and resumed');

      // Connect to WebSocket using the correct Supabase Edge Function URL
      const wsUrl = `wss://xxccvppbxnhowncdhvdi.functions.supabase.co/realtime-chat`;
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setConnectionState('connected');
        setVoiceState('idle');
        toast({
          title: "Connected",
          description: "Voice interface is ready",
        });
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received message type:', data.type);

          switch (data.type) {
            case 'session.created':
              console.log('🎯 Session created successfully');
              break;

            case 'session.updated':
              console.log('🔧 Session updated successfully');
              break;

            case 'input_audio_buffer.speech_started':
              console.log('🎤 Speech detection started');
              setVoiceState('listening');
              break;

            case 'input_audio_buffer.speech_stopped':
              console.log('🛑 Speech detection stopped');
              setVoiceState('processing');
              break;

            case 'response.created':
              console.log('💭 Response creation started');
              setCurrentTranscript('');
              break;

            case 'response.audio.delta':
              setVoiceState('speaking');
              if (data.delta && audioContextRef.current) {
                try {
                  const binaryString = atob(data.delta);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  await playAudioData(audioContextRef.current, bytes);
                } catch (audioError) {
                  console.error('❌ Error playing audio:', audioError);
                }
              }
              break;

            case 'response.audio_transcript.delta':
              if (data.delta) {
                setCurrentTranscript(prev => prev + data.delta);
              }
              break;

            case 'response.audio_transcript.done':
              if (data.transcript) {
                console.log('📝 Assistant transcript completed:', data.transcript);
                addMessage(data.transcript, 'assistant');
                setCurrentTranscript('');
              }
              break;

            case 'response.audio.done':
              console.log('🔊 Audio response completed');
              setVoiceState('idle');
              break;

            case 'input_audio_buffer.committed':
              console.log('✅ Audio buffer committed');
              break;

            case 'conversation.item.input_audio_transcription.completed':
              if (data.transcript) {
                console.log('📝 User transcript completed:', data.transcript);
                addMessage(data.transcript, 'user');
              }
              break;

            case 'error':
              console.error('❌ Realtime API error:', data);
              toast({
                title: "Error",
                description: data.error?.message || 'An error occurred',
                variant: "destructive",
              });
              break;

            default:
              console.log('❓ Unhandled message type:', data.type);
              break;
          }
        } catch (parseError) {
          console.error('❌ Error parsing WebSocket message:', parseError, event.data);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('❌ WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        setConnectionState('disconnected');
        setVoiceState('idle');
        
        if (event.code !== 1000) { // Not a normal closure
          toast({
            title: "Connection Lost",
            description: "Voice connection was lost. Please try reconnecting.",
            variant: "destructive",
          });
        }
        
        cleanup();
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionState('error');
        setVoiceState('idle');
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice service. Please check your network and try again.",
          variant: "destructive",
        });
      };

      // Start audio recording
      console.log('🎤 Starting audio recording...');
      audioRecorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            const base64Audio = encodeAudioForAPI(audioData);
            wsRef.current.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Audio
            }));
          } catch (encodingError) {
            console.error('❌ Error encoding audio:', encodingError);
          }
        }
      });

      await audioRecorderRef.current.start();
      console.log('✅ Audio recording started successfully');

    } catch (error) {
      console.error('❌ Error in connect function:', error);
      setConnectionState('error');
      setVoiceState('idle');
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: "destructive",
      });
      cleanup();
    }
  }, [connectionState, toast, addMessage, cleanup]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting...');
    cleanup();
    setConnectionState('disconnected');
    setVoiceState('idle');
    setMessages([]);
    setCurrentTranscript('');
    toast({
      title: "Disconnected",
      description: "Voice conversation ended",
    });
  }, [cleanup, toast]);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('📤 Sending text message:', text);
      
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
    } else {
      console.error('❌ Cannot send message: WebSocket not connected');
      toast({
        title: "Connection Error",
        description: "Please connect first before sending messages",
        variant: "destructive",
      });
    }
  }, [addMessage, toast]);

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
