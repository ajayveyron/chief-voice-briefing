import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ToolExecutionRequest {
  tool_name: string;
  parameters: Record<string, any>;
  user_id?: string;
  conversation_id?: string;
}

interface ToolExecutionResponse {
  success: boolean;
  result?: any;
  error?: string;
  tool_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("🔗 Webhook received:", req.method, req.url);

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", success: false }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const requestBody: ToolExecutionRequest = await req.json();
    console.log("📋 Tool execution request:", requestBody);

    const { tool_name, parameters } = requestBody;

    if (!tool_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing tool_name in request",
          tool_name: "",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Execute the MCP tool by calling the MCP server directly
    let toolResult: ToolExecutionResponse;

    try {
      // Get user's JWT token for MCP server authentication
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const userToken = session?.access_token;

      if (!userToken) {
        throw new Error("No user session found");
      }

      // Call the MCP server
      const mcpServerUrl = `${Deno.env.get(
        "SUPABASE_URL"
      )}/functions/v1/mcp-server`;

      console.log("🔧 Calling MCP server:", mcpServerUrl);

      const mcpResponse = await fetch(mcpServerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          tool: tool_name,
          parameters: parameters || {},
        }),
      });

      if (!mcpResponse.ok) {
        const errorText = await mcpResponse.text();
        throw new Error(
          `MCP server error: ${mcpResponse.status} - ${errorText}`
        );
      }

      const mcpResult = await mcpResponse.json();
      console.log("✅ MCP tool result:", mcpResult);

      toolResult = {
        success: true,
        result: mcpResult.data || mcpResult,
        tool_name,
      };
    } catch (error) {
      console.error("❌ Error executing MCP tool:", error);
      toolResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        tool_name,
      };
    }

    // Log the webhook execution for debugging
    console.log("📝 Webhook execution result:", toolResult);

    // Return the result to ElevenLabs
    return new Response(JSON.stringify(toolResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Webhook handler error",
        tool_name: "",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
