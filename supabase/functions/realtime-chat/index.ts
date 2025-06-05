
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  console.log("=== Realtime Chat Function Started ===");
  console.log("Request method:", req.method);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log("Not a WebSocket request, rejecting");
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  if (!openAIApiKey) {
    console.error("CRITICAL: OpenAI API key not found in environment");
    return new Response("OpenAI API key not configured", { status: 500 });
  }

  console.log("OpenAI API key found, proceeding with WebSocket upgrade");

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openAISocket: WebSocket | null = null;
  let sessionInitialized = false;
  let isConnected = false;

  console.log("WebSocket connection established with client");

  socket.onopen = () => {
    console.log("=== Client WebSocket OPENED ===");
    isConnected = true;
    
    // Connect to OpenAI Realtime API
    const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
    console.log("Connecting to OpenAI Realtime API:", openAIUrl);
    
    try {
      openAISocket = new WebSocket(openAIUrl, {
        headers: {
          "Authorization": `Bearer ${openAIApiKey}`,
          "OpenAI-Beta": "realtime=v1"
        }
      });

      openAISocket.onopen = () => {
        console.log("=== OpenAI WebSocket CONNECTED SUCCESSFULLY ===");
      };

      openAISocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Received from OpenAI:", data.type);
          
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
            console.log("🔧 Sending session update to OpenAI");
            openAISocket?.send(JSON.stringify(sessionUpdate));
          }
          
          // Forward all messages to client
          if (isConnected && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          } else {
            console.warn("Cannot send to client: socket not ready");
          }
        } catch (error) {
          console.error("❌ Error processing OpenAI message:", error);
        }
      };

      openAISocket.onclose = (event) => {
        console.log("❌ OpenAI WebSocket closed:", event.code, event.reason);
        if (isConnected && socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "OpenAI connection closed");
        }
      };

      openAISocket.onerror = (error) => {
        console.error("❌ OpenAI WebSocket error:", error);
        if (isConnected && socket.readyState === WebSocket.OPEN) {
          socket.close(1011, "OpenAI connection error");
        }
      };

    } catch (error) {
      console.error("❌ Failed to create OpenAI WebSocket:", error);
      if (isConnected && socket.readyState === WebSocket.OPEN) {
        socket.close(1011, "Failed to connect to OpenAI");
      }
    }
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("📤 Received from client:", data.type);
      
      // Forward client messages to OpenAI
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else {
        console.error("❌ Cannot forward to OpenAI: WebSocket not ready, state:", openAISocket?.readyState);
      }
    } catch (error) {
      console.error("❌ Error processing client message:", error);
    }
  };

  socket.onclose = (event) => {
    console.log("=== Client WebSocket CLOSED ===", event.code, event.reason);
    isConnected = false;
    if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  socket.onerror = (error) => {
    console.error("❌ Client WebSocket error:", error);
    isConnected = false;
    if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  return response;
});
