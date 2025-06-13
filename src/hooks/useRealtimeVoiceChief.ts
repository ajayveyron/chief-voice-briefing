import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeAudioRecorder, RealtimeAudioPlayer } from '@/utils/realtimeVoiceUtils';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type ConversationState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface RealtimeMessage {
  type: string;
  [key: string]: any;
}

export const useRealtimeVoiceChief = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<RealtimeAudioRecorder | null>(null);
  const playerRef = useRef<RealtimeAudioPlayer | null>(null);
  const { toast } = useToast();

  const connect = useCallback(async () => {
    if (connectionState === 'connected' || connectionState === 'connecting') return;

    try {
      setConnectionState('connecting');
      console.log('🔌 Connecting to realtime voice chief...');

      // Initialize audio player
      playerRef.current = new RealtimeAudioPlayer();

      // Connect to WebSocket - using the correct Supabase function URL
      const wsUrl = `wss://xxccvppbxnhowncdhvdi.supabase.co/functions/v1/realtime-voice-chief`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = async () => {
        console.log('✅ Connected to voice chief');
        setConnectionState('connected');
        setConversationState('idle');
        
        // Initialize audio recorder
        try {
          recorderRef.current = new RealtimeAudioRecorder((audioData) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: audioData
              }));
            }
          });
          await recorderRef.current.start();
          
          toast({
            title: "Connected",
            description: "Voice chief is ready. Start speaking!",
          });
        } catch (error) {
          console.error('❌ Error starting recorder:', error);
          toast({
            title: "Microphone Error",
            description: "Could not access microphone. Please check permissions.",
            variant: "destructive",
          });
        }
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('📦 Received:', data.type);
        
        setMessages(prev => [...prev, data]);
        
        switch (data.type) {
          case 'session.created':
            console.log('🎯 Session created');
            break;
            
          case 'session.updated':
            console.log('⚙️ Session updated');
            break;
            
          case 'input_audio_buffer.speech_started':
            setConversationState('listening');
            setCurrentTranscript('');
            break;
            
          case 'input_audio_buffer.speech_stopped':
            setConversationState('thinking');
            break;
            
          case 'response.audio_transcript.delta':
            if (data.delta) {
              setCurrentTranscript(prev => prev + data.delta);
            }
            break;
            
          case 'response.audio.delta':
            if (data.delta && playerRef.current) {
              setConversationState('speaking');
              await playerRef.current.addToQueue(data.delta);
            }
            break;
            
          case 'response.audio.done':
            setConversationState('idle');
            setCurrentTranscript('');
            break;
            
          case 'response.done':
            setConversationState('idle');
            break;
            
          case 'error':
            console.error('❌ OpenAI error:', data.message);
            toast({
              title: "Error",
              description: data.message,
              variant: "destructive",
            });
            break;
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionState('error');
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice chief",
          variant: "destructive",
        });
      };

      wsRef.current.onclose = () => {
        console.log('🔌 WebSocket closed');
        setConnectionState('disconnected');
        setConversationState('idle');
        cleanup();
      };

    } catch (error) {
      console.error('❌ Connection error:', error);
      setConnectionState('error');
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: "destructive",
      });
    }
  }, [connectionState, toast]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting from voice chief...');
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    cleanup();
    setConnectionState('disconnected');
    setConversationState('idle');
    setCurrentTranscript('');
    
    toast({
      title: "Disconnected",
      description: "Voice chief session ended",
    });
  }, [toast]);

  const cleanup = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    
    if (playerRef.current) {
      playerRef.current.clear();
      playerRef.current = null;
    }
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      };
      
      wsRef.current.send(JSON.stringify(message));
      wsRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  }, []);

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
    messages,
    connect,
    disconnect,
    sendTextMessage
  };
};
