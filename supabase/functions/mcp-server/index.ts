import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// Available MCP tools
const AVAILABLE_TOOLS = [
  {
    name: "vector_search",
    description:
      "Search through user's vector embeddings to find relevant content from emails, documents, and data",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant content",
        },
        source_type: {
          type: "string",
          description:
            "Type of source to search (gmail, calendar, slack, notion)",
          enum: ["gmail", "calendar", "slack", "notion"],
        },
        topK: {
          type: "number",
          description: "Number of top results to return",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_updates",
    description: "Get recent summaries and updates for the user",
    inputSchema: {
      type: "object",
      properties: {
        unread_only: {
          type: "boolean",
          description: "Whether to show only unread items",
          default: true,
        },
      },
      required: [],
    },
  },
  {
    name: "fetch_gmail_emails",
    description:
      "Fetch recent Gmail emails (sent and received) from the last 7 days",
    inputSchema: {
      type: "object",
      properties: {
        days_back: {
          type: "number",
          description: "Number of days back to fetch emails",
          default: 7,
        },
      },
      required: [],
    },
  },
  {
    name: "send_email",
    description: "Send an email via Gmail",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string" },
          description: "Array of recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "Array of CC email addresses",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body content",
        },
        isHtml: {
          type: "boolean",
          description: "Whether the email body is HTML formatted",
          default: false,
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "manage_calendar",
    description: "Create, read, update, or delete calendar events",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "read", "update", "delete"],
          description: "Action to perform on calendar",
        },
        eventId: {
          type: "string",
          description: "Event ID (required for update/delete)",
        },
        summary: {
          type: "string",
          description: "Event title/summary",
        },
        description: {
          type: "string",
          description: "Event description",
        },
        start: {
          type: "object",
          properties: {
            dateTime: {
              type: "string",
              description: "Start time (ISO string)",
            },
            timeZone: { type: "string", description: "Timezone" },
          },
          required: ["dateTime"],
        },
        end: {
          type: "object",
          properties: {
            dateTime: { type: "string", description: "End time (ISO string)" },
            timeZone: { type: "string", description: "Timezone" },
          },
          required: ["dateTime"],
        },
        attendees: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              displayName: { type: "string" },
            },
          },
          description: "Event attendees",
        },
        location: {
          type: "string",
          description: "Event location",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "fetch_calendar_events",
    description: "Fetch calendar events for a specific time period",
    inputSchema: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description: "Start time for events (ISO string)",
        },
        timeMax: {
          type: "string",
          description: "End time for events (ISO string)",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of events to return",
          default: 10,
        },
      },
      required: [],
    },
  },
  {
    name: "fetch_slack_messages",
    description: "Fetch recent Slack messages from connected channels",
    inputSchema: {
      type: "object",
      properties: {
        channel_id: {
          type: "string",
          description: "Specific Slack channel ID to fetch from",
        },
        limit: {
          type: "number",
          description: "Number of messages to fetch",
          default: 20,
        },
      },
      required: [],
    },
  },
  {
    name: "send_slack_message",
    description: "Send a message to a Slack channel",
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          description: "Slack channel ID or name",
        },
        message: {
          type: "string",
          description: "Message content to send",
        },
        thread_ts: {
          type: "string",
          description: "Thread timestamp if replying to a thread",
        },
      },
      required: ["channel", "message"],
    },
  },
  {
    name: "fetch_notion_pages",
    description: "Fetch pages from connected Notion workspace",
    inputSchema: {
      type: "object",
      properties: {
        database_id: {
          type: "string",
          description: "Notion database ID to query",
        },
        filter: {
          type: "object",
          description: "Notion filter object",
        },
        page_size: {
          type: "number",
          description: "Number of pages to return",
          default: 10,
        },
      },
      required: [],
    },
  },
  {
    name: "semantic_search",
    description: "Perform semantic search across all connected data sources",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description:
            "Data sources to search (gmail, slack, notion, calendar)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return",
          default: 10,
        },
      },
      required: ["query"],
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  console.log(`MCP Server received ${req.method} request to ${pathname}`);

  // Handle GET requests (tool discovery and health check)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        tools: AVAILABLE_TOOLS,
        status: "ok",
        message: "MCP Server is running",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Handle POST requests (tool execution)
  if (req.method === "POST") {
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: {
            headers: { Authorization: req.headers.get("Authorization")! },
          },
        }
      );

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requestBody = await req.json();
      console.log("Received request body:", requestBody);

      // Extract tool name from request body
      const toolName = requestBody.tool;
      const parameters = requestBody.parameters || {};

      if (!toolName) {
        return new Response(
          JSON.stringify({
            error: "Missing tool name in request body",
            expectedFormat: { tool: "tool_name", parameters: {} },
            availableTools: AVAILABLE_TOOLS.map((t) => t.name),
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const tool = AVAILABLE_TOOLS.find((t) => t.name === toolName);

      if (!tool) {
        return new Response(
          JSON.stringify({
            error: "Tool not found",
            requestedTool: toolName,
            availableTools: AVAILABLE_TOOLS.map((t) => t.name),
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Executing tool: ${toolName} with parameters:`, parameters);

      if (toolName === "vector_search") {
        const { data, error } = await supabaseClient.functions.invoke(
          "vector-search",
          {
            body: {
              query: parameters.query,
              user_id: user.id,
              source_type: parameters.source_type,
              topK: parameters.topK || 5,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data: data.results || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "get_updates") {
        const { data: summaries, error } = await supabaseClient
          .from("summaries")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_viewed", parameters.unread_only !== false)
          .order("processed_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        return new Response(JSON.stringify({ data: summaries || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "fetch_gmail_emails") {
        const { data, error } = await supabaseClient.functions.invoke(
          "fetch-gmail-emails",
          {
            body: {
              days_back: parameters.days_back || 7,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "send_email") {
        const { data, error } = await supabaseClient.functions.invoke(
          "send-email",
          {
            body: {
              to: parameters.to,
              cc: parameters.cc,
              subject: parameters.subject,
              body: parameters.body,
              isHtml: parameters.isHtml || false,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "manage_calendar") {
        const { data, error } = await supabaseClient.functions.invoke(
          "manage-calendar",
          {
            body: parameters,
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "fetch_calendar_events") {
        const { data, error } = await supabaseClient.functions.invoke(
          "fetch-calendar-events",
          {
            body: {
              timeMin: parameters.timeMin,
              timeMax: parameters.timeMax,
              maxResults: parameters.maxResults || 10,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "fetch_slack_messages") {
        const { data, error } = await supabaseClient.functions.invoke(
          "fetch-slack-messages",
          {
            body: {
              channel_id: parameters.channel_id,
              limit: parameters.limit || 20,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "send_slack_message") {
        const { data, error } = await supabaseClient.functions.invoke(
          "send-slack-message",
          {
            body: {
              channel: parameters.channel,
              message: parameters.message,
              thread_ts: parameters.thread_ts,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "fetch_notion_pages") {
        const { data, error } = await supabaseClient.functions.invoke(
          "fetch-notion-pages",
          {
            body: {
              database_id: parameters.database_id,
              filter: parameters.filter,
              page_size: parameters.page_size || 10,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (toolName === "semantic_search") {
        const { data, error } = await supabaseClient.functions.invoke(
          "semantic-search",
          {
            body: {
              query: parameters.query,
              sources: parameters.sources,
              limit: parameters.limit || 10,
            },
          }
        );

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          error: "Unknown tool",
          requestedTool: toolName,
          availableTools: AVAILABLE_TOOLS.map((t) => t.name),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error executing tool:", error);
      return new Response(
        JSON.stringify({
          error: error.message,
          details: "Tool execution failed",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // Default response for unknown methods
  return new Response(
    JSON.stringify({
      error: "Method not allowed",
      allowedMethods: ["GET", "POST"],
      message: "GET for tool discovery/health, POST for tool execution",
    }),
    {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
