import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log("🔌 Realtime voice chief function called");
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log("❌ Expected WebSocket connection");
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Get OpenAI API key from environment
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not found");
    return new Response("Server configuration error", { status: 500 });
  }
  
  console.log("✅ API Key found, length:", OPENAI_API_KEY.length);

  console.log("✅ Upgrading to WebSocket");
  
  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let openAISocket: WebSocket | null = null;
    let sessionCreated = false;

    // WebSocket connection opened
    socket.onopen = async () => {
      console.log("🎯 Client WebSocket connected, connecting to OpenAI...");
      
      try {
        // Connect to OpenAI Realtime API with proper headers
        const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
        
        console.log("🔑 Attempting OpenAI connection with API key length:", OPENAI_API_KEY.length);
        
        // Create WebSocket with authorization header
        openAISocket = new WebSocket(openAIUrl, ["realtime"], {
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1"
          }
        });

        openAISocket.onopen = () => {
          console.log("✅ Connected to OpenAI Realtime API");
        };
      } catch (error) {
        console.error("❌ Failed to create OpenAI WebSocket:", error);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "error",
            message: `Failed to connect to OpenAI: ${error.message}`
          }));
        }
        return;
      }

      openAISocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📦 OpenAI -> Client:", data.type);

          // Handle session creation - send session update after creation
          if (data.type === "session.created" && !sessionCreated) {
            sessionCreated = true;
            console.log("🎯 Session created, sending session update");
            
            const sessionUpdate = {
              type: "session.update",
              session: {
                modalities: ["text", "audio"],
                instructions: `You are Chief, an AI executive assistant. You help busy professionals manage their day efficiently.

Key capabilities:
- Calendar management and scheduling
- Email prioritization and drafting
- Task organization and reminders
- Meeting preparation and follow-ups
- Daily briefings and summaries

Personality:
- Professional yet approachable
- Concise but thorough
- Proactive in suggesting improvements
- Always respectful of time
- Confident in handling executive-level tasks

Remember to be helpful, efficient, and speak naturally as if you're a trusted assistant who knows the user's preferences and work style.`,
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

            if (openAISocket?.readyState === WebSocket.OPEN) {
              openAISocket.send(JSON.stringify(sessionUpdate));
            }
          }

          // Forward all messages to client
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        } catch (error) {
          console.error("❌ Error processing OpenAI message:", error);
        }
      };

      openAISocket.onerror = (error) => {
        console.error("❌ OpenAI WebSocket error:", error);
        const errorMessage = error instanceof ErrorEvent ? error.message : 
                           error instanceof Error ? error.message : 
                           'OpenAI WebSocket connection failed';
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "error",
            message: errorMessage
          }));
        }
      };

      openAISocket.onclose = (event) => {
        console.log("🔌 OpenAI WebSocket closed:", event.code, event.reason);
        const closeMessage = event.reason || `Connection closed with code ${event.code}`;
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "error", 
            message: `OpenAI connection closed: ${closeMessage}`
          }));
          socket.close();
        }
      };
    };

    // Forward client messages to OpenAI
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📦 Client -> OpenAI:", data.type);
        
        if (openAISocket?.readyState === WebSocket.OPEN) {
          openAISocket.send(event.data);
        } else {
          console.warn("⚠️ OpenAI socket not ready, message dropped");
        }
      } catch (error) {
        console.error("❌ Error processing client message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("❌ Client WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("🔌 Client WebSocket closed");
      if (openAISocket?.readyState === WebSocket.OPEN) {
        openAISocket.close();
      }
    };

    return response;
  } catch (error) {
    console.error("❌ WebSocket upgrade failed:", error);
    return new Response("WebSocket upgrade failed", { status: 500 });
  }
});