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

const AVAILABLE_TOOLS: MCPTool[] = [
  {
    name: "vector_search",
    description: "Search through user's embedded data using semantic similarity",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        source_type: {
          type: "string",
          description: "Optional source type filter (gmail, calendar, slack, notion)"
        },
        topK: {
          type: "number",
          description: "Number of results to return (default: 5)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_updates",
    description: "Get recent updates and summaries for the user",
    inputSchema: {
      type: "object",
      properties: {
        unread_only: {
          type: "boolean",
          description: "Only return unread updates (default: true)"
        }
      },
      required: []
    }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  // Handle tools discovery
  if (pathname === "/tools" && req.method === "GET") {
    return new Response(
      JSON.stringify({ tools: AVAILABLE_TOOLS }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Handle tool execution
  if (pathname.startsWith("/tools/") && req.method === "POST") {
    const toolName = pathname.split("/")[2];
    const tool = AVAILABLE_TOOLS.find(t => t.name === toolName);
    
    if (!tool) {
      return new Response(
        JSON.stringify({ error: "Tool not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const params = await req.json();

      if (toolName === "vector_search") {
        const { data, error } = await supabaseClient.functions.invoke("vector-search", {
          body: {
            query: params.query,
            user_id: user.id,
            source_type: params.source_type,
            topK: params.topK || 5,
          },
        });

        if (error) throw error;

        return new Response(
          JSON.stringify({ data: data.results || [] }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (toolName === "get_updates") {
        const { data: summaries, error } = await supabaseClient
          .from("summaries")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_viewed", params.unread_only !== false)
          .order("processed_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        return new Response(
          JSON.stringify({ data: summaries || [] }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Unknown tool" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    } catch (error) {
      console.error("Error executing tool:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // Health check
  if (pathname === "/health" && req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ error: "Not found" }),
    {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});