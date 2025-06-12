
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  let openaiWs: WebSocket | null = null;

  socket.addEventListener("open", async () => {
    console.log("🔌 Client connected to realtime voice chief");
    
    try {
      // Connect to OpenAI Realtime API
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      openaiWs = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
        {
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );

      openaiWs.onopen = () => {
        console.log("🤖 Connected to OpenAI Realtime API");
        
        // Configure session for Chief of Staff persona
        const sessionConfig = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are Chief, a highly capable AI Chief of Staff assistant. You help manage daily tasks, emails, calendar, and provide intelligent assistance throughout the day.

Key capabilities:
- Fetch and summarize emails, calendar events, and updates
- Schedule meetings and manage calendar
- Send emails and messages
- Provide contextual, conversational assistance
- Remember conversation context
- Take actions through integrations

Personality:
- Professional yet friendly
- Efficient and helpful
- Proactive in suggesting actions
- Clear and concise communication
- Remember previous conversation context

Always be ready to help with scheduling, email management, updates, and any other chief of staff duties.`,
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
            tools: [
              {
                type: "function",
                name: "get_daily_updates",
                description: "Get daily updates including emails, calendar events, and other notifications",
                parameters: {
                  type: "object",
                  properties: {
                    include_emails: { type: "boolean", description: "Include email updates" },
                    include_calendar: { type: "boolean", description: "Include calendar events" },
                    include_notifications: { type: "boolean", description: "Include other notifications" }
                  }
                }
              },
              {
                type: "function",
                name: "schedule_meeting",
                description: "Schedule a new calendar meeting",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Meeting title" },
                    datetime: { type: "string", description: "Meeting date and time" },
                    attendees: { type: "array", items: { type: "string" }, description: "Attendee emails" },
                    location: { type: "string", description: "Meeting location" }
                  },
                  required: ["title", "datetime"]
                }
              },
              {
                type: "function",
                name: "send_email",
                description: "Send an email",
                parameters: {
                  type: "object",
                  properties: {
                    to: { type: "array", items: { type: "string" }, description: "Recipient emails" },
                    subject: { type: "string", description: "Email subject" },
                    body: { type: "string", description: "Email body" }
                  },
                  required: ["to", "subject", "body"]
                }
              }
            ],
            tool_choice: "auto",
            temperature: 0.7,
            max_response_output_tokens: "inf"
          }
        };

        openaiWs?.send(JSON.stringify(sessionConfig));
      };

      openaiWs.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("📦 OpenAI message:", data.type);

        // Handle function calls
        if (data.type === "response.function_call_arguments.done") {
          await handleFunctionCall(data, openaiWs, socket);
        }

        // Forward all messages to client
        socket.send(JSON.stringify(data));
      };

      openaiWs.onerror = (error) => {
        console.error("❌ OpenAI WebSocket error:", error);
        socket.send(JSON.stringify({ type: "error", message: "OpenAI connection error" }));
      };

      openaiWs.onclose = () => {
        console.log("🔌 OpenAI WebSocket closed");
        socket.send(JSON.stringify({ type: "connection_closed", message: "OpenAI connection closed" }));
      };

    } catch (error) {
      console.error("❌ Error connecting to OpenAI:", error);
      socket.send(JSON.stringify({ type: "error", message: error.message }));
    }
  });

  socket.addEventListener("message", (event) => {
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(event.data);
    }
  });

  socket.addEventListener("close", () => {
    console.log("🔌 Client disconnected");
    if (openaiWs) {
      openaiWs.close();
    }
  });

  return response;
});

async function handleFunctionCall(data: any, openaiWs: WebSocket, clientSocket: WebSocket) {
  const { call_id, name, arguments: args } = data;
  const parsedArgs = JSON.parse(args);
  
  console.log(`🔧 Function call: ${name}`, parsedArgs);

  let result = { success: false, message: "Function not implemented" };

  try {
    switch (name) {
      case "get_daily_updates":
        result = await getDailyUpdates(parsedArgs);
        break;
      case "schedule_meeting":
        result = await scheduleMeeting(parsedArgs);
        break;
      case "send_email":
        result = await sendEmail(parsedArgs);
        break;
    }
  } catch (error) {
    console.error(`❌ Error executing function ${name}:`, error);
    result = { success: false, message: error.message };
  }

  // Send function result back to OpenAI
  const functionResult = {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id,
      output: JSON.stringify(result)
    }
  };

  openaiWs.send(JSON.stringify(functionResult));
  openaiWs.send(JSON.stringify({ type: "response.create" }));
}

async function getDailyUpdates(args: any) {
  try {
    // This would call your existing Chief summary function
    // For now, return a mock response
    return {
      success: true,
      summary: "📊 Today's Updates:\n📧 5 new emails\n📅 3 upcoming meetings\n💬 2 Slack mentions\n🚨 1 high priority task",
      details: {
        emails: 5,
        meetings: 3,
        notifications: 2
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function scheduleMeeting(args: any) {
  try {
    // This would call your existing calendar management function
    return {
      success: true,
      message: `Meeting "${args.title}" scheduled for ${args.datetime}`,
      event_id: "mock_event_123"
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function sendEmail(args: any) {
  try {
    // This would call your existing email sending function
    return {
      success: true,
      message: `Email sent to ${args.to.join(", ")} with subject "${args.subject}"`,
      message_id: "mock_email_123"
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
