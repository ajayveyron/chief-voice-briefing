
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  console.log("Received request, checking for WebSocket upgrade");
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log("Not a WebSocket request");
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  if (!openAIApiKey) {
    console.error("OpenAI API key not found");
    return new Response("OpenAI API key not configured", { status: 500 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openAISocket: WebSocket | null = null;
  let sessionInitialized = false;

  console.log("WebSocket connection established with client");

  socket.onopen = () => {
    console.log("Client WebSocket opened, connecting to OpenAI");
    
    // Connect to OpenAI Realtime API with correct URL and headers
    const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
    console.log("Connecting to OpenAI:", openAIUrl);
    
    openAISocket = new WebSocket(openAIUrl, {
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    openAISocket.onopen = () => {
      console.log("Successfully connected to OpenAI Realtime API");
    };

    openAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received from OpenAI:", data.type);
        
        // Send session update after receiving session.created
        if (data.type === 'session.created' && !sessionInitialized) {
          sessionInitialized = true;
          const sessionUpdate = {
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: "You are Chief, an AI assistant that helps users manage their notifications and updates. Be helpful, conversational, and focus on helping them stay organized with their notifications. Keep responses concise and natural for voice conversation.",
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1"
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.8,
              max_response_output_tokens: "inf"
            }
          };
          console.log("Sending session update to OpenAI");
          openAISocket?.send(JSON.stringify(sessionUpdate));
        }
        
        // Forward all messages to client
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      } catch (error) {
        console.error("Error processing OpenAI message:", error);
      }
    };

    openAISocket.onclose = (event) => {
      console.log("OpenAI WebSocket closed:", event.code, event.reason);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };

    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received from client:", data.type);
      
      // Forward client messages to OpenAI
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else {
        console.error("OpenAI WebSocket not ready, state:", openAISocket?.readyState);
      }
    } catch (error) {
      console.error("Error processing client message:", error);
    }
  };

  socket.onclose = () => {
    console.log("Client WebSocket closed");
    openAISocket?.close();
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
    openAISocket?.close();
  };

  return response;
});
