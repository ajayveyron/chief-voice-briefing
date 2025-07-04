import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Slack callback function invoked with method:", req.method);
    console.log("Request URL:", req.url);

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Use the same approach as Gmail callback - hardcoded frontend URL
    const frontendUrl =
      "https://preview--chief-executive-assistant.lovable.app";

    console.log("Frontend URL Debug:", {
      frontendUrl,
      requestUrl: req.url,
    });

    const redirectToFrontend = (path: string) => {
      const redirectUrl = new URL(path, frontendUrl);
      console.log("Redirect Debug:", {
        frontendUrl,
        path,
        generatedRedirectUrl: redirectUrl.toString(),
      });
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    };

    console.log("Callback parameters:", {
      hasCode: !!code,
      hasState: !!state,
      error,
      codeLength: code?.length,
      stateValue: state,
    });

    if (error) {
      console.error("OAuth error from Slack:", error);
      return redirectToFrontend(
        `/?error=oauth_error&details=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      console.error("Missing required parameters:", {
        hasCode: !!code,
        hasState: !!state,
      });
      return redirectToFrontend("/?error=missing_params");
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("SLACK_CLIENT_ID");
    const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET");

    console.log("Environment check:", {
      supabaseUrl: !!supabaseUrl,
      serviceRoleKey: !!serviceRoleKey,
      clientId: !!clientId,
      clientSecret: !!clientSecret,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 20),
    });

    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
      console.error("Missing environment variables:", {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey,
        SLACK_CLIENT_ID: !!clientId,
        SLACK_CLIENT_SECRET: !!clientSecret,
      });
      return redirectToFrontend("/?error=config_error");
    }

    // Create Supabase admin client with service role key (bypasses RLS)
    console.log("Creating Supabase admin client");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify state token using admin client
    console.log("Looking up OAuth state:", state);
    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state_token", state)
      .eq("integration_type", "slack")
      .single();

    if (stateError) {
      console.error("Error looking up OAuth state:", stateError);
      return redirectToFrontend("/?error=invalid_state");
    }

    if (!oauthState) {
      console.error("Invalid state token - no matching record found:", state);
      return redirectToFrontend("/?error=invalid_state");
    }

    console.log("OAuth state found for user:", oauthState.user_id);

    // Exchange code for tokens
    console.log("Exchanging code for tokens");
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: oauthState.redirect_uri || "",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", tokenResponse.status, errorText);
      return redirectToFrontend("/?error=token_exchange_failed");
    }

    const tokens = await tokenResponse.json();
    console.log("Token exchange response:", {
      ok: tokens.ok,
      hasAccessToken: !!tokens.access_token,
      teamName: tokens.team?.name,
      error: tokens.error,
    });

    if (!tokens.ok || tokens.error) {
      console.error("Slack OAuth token error:", tokens.error);
      return redirectToFrontend("/?error=token_error");
    }

    // Test Slack API access with the new token
    console.log("Testing Slack API access");
    const slackTestResponse = await fetch("https://slack.com/api/auth.test", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!slackTestResponse.ok) {
      const errorText = await slackTestResponse.text();
      console.error(
        "Slack API test failed:",
        slackTestResponse.status,
        errorText
      );
      return redirectToFrontend("/?error=slack_api_failed");
    }

    const slackProfile = await slackTestResponse.json();
    console.log("Slack API test successful, user:", slackProfile.user);

    // Use upsert to handle existing integrations gracefully
    console.log("Upserting integration for user:", oauthState.user_id);
    const { error: upsertError } = await supabase
      .from("user_integrations")
      .upsert(
        {
          user_id: oauthState.user_id,
          integration_type: "slack",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          is_active: true,
          integration_data: {
            team_id: tokens.team?.id,
            team_name: tokens.team?.name,
            user_id: tokens.authed_user?.id,
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,integration_type",
        }
      );

    if (upsertError) {
      console.error("Error storing integration:", upsertError);
      return redirectToFrontend("/?error=storage_error");
    }

    console.log("Integration upserted successfully");

    // Clean up state using admin client
    console.log("Cleaning up OAuth state");
    const { error: deleteError } = await supabase
      .from("oauth_states")
      .delete()
      .eq("id", oauthState.id);

    if (deleteError) {
      console.error("Error cleaning up state:", deleteError);
      // Don't fail the request for cleanup errors
    }

    // Redirect back to home page with success message
    console.log("Redirecting to:", `${frontendUrl}/?connected=slack`);
    return redirectToFrontend("/?connected=slack");
  } catch (error) {
    console.error("Unexpected error in slack-callback:", error);
    const frontendUrl =
      "https://preview--chief-executive-assistant.lovable.app";
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${frontendUrl}/?error=unexpected_error`,
      },
    });
  }
});
