import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verify WebSocket upgrade request
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  try {
    // Upgrade to WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req);
    let openaiWs: WebSocket | null = null;

    // Client WebSocket event handlers
    socket.onopen = () => {
      console.log("🔌 Client connected to realtime voice chief");
    };

    socket.onmessage = (event) => {
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(event.data);
      }
    };

    socket.onclose = () => {
      console.log("🔌 Client disconnected");
      openaiWs?.close();
    };

    socket.onerror = (error) => {
      console.error("❌ Client WebSocket error:", error);
      openaiWs?.close();
    };

    // Connect to OpenAI Realtime API
    try {
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
        
        // Configure session
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
- Remember previous conversation context`,
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
            max_response_output_tokens: 4096
          }
        };

        openaiWs.send(JSON.stringify(sessionConfig));
      };

      openaiWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📦 OpenAI message:", data.type);

          // Handle function calls
          if (data.type === "response.function_call_arguments.done") {
            handleFunctionCall(data, openaiWs, socket).catch(console.error);
          }

          // Forward message to client
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        } catch (error) {
          console.error("Error processing OpenAI message:", error);
        }
      };

      openaiWs.onerror = (error) => {
        console.error("❌ OpenAI WebSocket error:", error);
        socket.send(JSON.stringify({ 
          type: "error", 
          message: "OpenAI connection error" 
        }));
      };

      openaiWs.onclose = () => {
        console.log("🔌 OpenAI WebSocket closed");
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ 
            type: "connection_closed", 
            message: "OpenAI connection closed" 
          }));
        }
      };

    } catch (error) {
      console.error("❌ Error connecting to OpenAI:", error);
      socket.send(JSON.stringify({ 
        type: "error", 
        message: error.message 
      }));
      socket.close();
    }

    return response;

  } catch (error) {
    console.error("WebSocket upgrade failed:", error);
    return new Response("WebSocket upgrade failed", { status: 500 });
  }
});

async function handleFunctionCall(data: any, openaiWs: WebSocket, clientSocket: WebSocket) {
  try {
    const { call_id, name, arguments: args } = data;
    const parsedArgs = JSON.parse(args);
    
    console.log(`🔧 Function call: ${name}`, parsedArgs);

    let result: any;
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
      default:
        result = { success: false, message: "Function not implemented" };
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

  } catch (error) {
    console.error("Error handling function call:", error);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: "error",
        message: `Function call failed: ${error.message}`
      }));
    }
  }
}

async function getDailyUpdates(args: any) {
  // In a real implementation, you would:
  // 1. Connect to email/calendar APIs
  // 2. Fetch the actual data
  // 3. Process and summarize it
  
  return {
    success: true,
    summary: "📊 Today's Updates:\n📧 5 new emails\n📅 3 upcoming meetings\n💬 2 Slack mentions\n🚨 1 high priority task",
    details: {
      emails: [
        { from: "john@example.com", subject: "Project Update", summary: "Waiting for your feedback" },
        { from: "team@company.com", subject: "Weekly Sync", summary: "Meeting agenda attached" }
      ],
      meetings: [
        { title: "Standup", time: "10:00 AM", participants: 5 },
        { title: "Project Review", time: "2:00 PM", participants: 3 }
      ],
      notifications: [
        { source: "Slack", message: "New message in #general" },
        { source: "Task", message: "Deadline approaching for Q2 report" }
      ]
    }
  };
}

async function scheduleMeeting(args: any) {
  // In a real implementation, you would:
  // 1. Validate the input
  // 2. Connect to calendar API
  // 3. Create the event
  
  if (!args.title || !args.datetime) {
    return { success: false, message: "Title and datetime are required" };
  }

  return {
    success: true,
    message: `Meeting "${args.title}" scheduled for ${args.datetime}`,
    event_id: "event_" + Math.random().toString(36).substring(2, 9),
    calendar_link: "https://calendar.example.com/event/mock123"
  };
}

async function sendEmail(args: any) {
  // In a real implementation, you would:
  // 1. Validate recipients, subject, body
  // 2. Connect to email API
  // 3. Send the message
  
  if (!args.to || args.to.length === 0) {
    return { success: false, message: "At least one recipient is required" };
  }

  return {
    success: true,
    message: `Email sent to ${args.to.join(", ")} with subject "${args.subject}"`,
    message_id: "email_" + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString()
  };
}