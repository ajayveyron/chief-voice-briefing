
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Helper for redirecting
function redirectWithError(frontendUrl: string, error: string) {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: `${frontendUrl}/?error=${error}`,
    },
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Gmail callback function invoked with method:", req.method);
    console.log("Request URL:", req.url);

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    console.log("Callback parameters:", {
      hasCode: !!code,
      hasState: !!state,
      error,
      codeLength: code?.length,
      stateValue: state,
    });

    // Use the frontend URL for final redirect
    const frontendUrl = "https://preview--chief-executive-assistant.lovable.app";

    if (error) {
      console.error("OAuth error from Google:", error);
      return redirectWithError(frontendUrl, "oauth_error");
    }

    if (!code || !state) {
      console.error("Missing required parameters:", {
        hasCode: !!code,
        hasState: !!state,
      });
      return redirectWithError(frontendUrl, "missing_params");
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    console.log("Environment check:", {
      supabaseUrl: !!supabaseUrl,
      serviceRoleKey: !!serviceRoleKey,
      clientId: !!clientId,
      clientSecret: !!clientSecret,
    });

    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
      console.error("Missing environment variables");
      return redirectWithError(frontendUrl, "config_error");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify state token
    console.log("Looking up OAuth state:", state);
    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state_token", state)
      .eq("integration_type", "gmail")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !oauthState) {
      console.error("Invalid state token:", stateError?.message || "State not found");
      return redirectWithError(frontendUrl, "invalid_state");
    }

    console.log("OAuth state found for user:", oauthState.user_id);

    // Exchange code for tokens
    console.log("Exchanging code for tokens");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${supabaseUrl}/functions/v1/gmail-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", tokenResponse.status, errorText);
      return redirectWithError(frontendUrl, "token_exchange_failed");
    }

    const tokens = await tokenResponse.json();
    console.log("Token exchange response:", {
      success: !tokens.error,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
    });

    if (tokens.error) {
      console.error("OAuth token error:", tokens.error, tokens.error_description);
      return redirectWithError(frontendUrl, "token_error");
    }

    // Test Gmail API access
    console.log("Testing Gmail API access");
    const gmailTestResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!gmailTestResponse.ok) {
      const errorText = await gmailTestResponse.text();
      console.error("Gmail API test failed:", gmailTestResponse.status, errorText);
      return redirectWithError(frontendUrl, "gmail_api_failed");
    }

    const gmailProfile = await gmailTestResponse.json();
    console.log("Gmail API test successful, profile email:", gmailProfile.emailAddress);

    // Store integration
    console.log("Storing integration for user:", oauthState.user_id);
    const { data: existingIntegration } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", oauthState.user_id)
      .eq("integration_type", "gmail")
      .single();

    let insertError = null;

    if (existingIntegration) {
      const { error: updateError } = await supabase
        .from("user_integrations")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", oauthState.user_id)
        .eq("integration_type", "gmail");

      insertError = updateError;
    } else {
      const { error: createError } = await supabase
        .from("user_integrations")
        .insert({
          user_id: oauthState.user_id,
          integration_type: "gmail",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          is_active: true,
        });

      insertError = createError;
    }

    if (insertError) {
      console.error("Error storing integration:", insertError);
      return redirectWithError(frontendUrl, "storage_error");
    }

    console.log("Integration stored successfully");

    // Clean up state
    await supabase
      .from("oauth_states")
      .delete()
      .eq("id", oauthState.id);

    // Redirect to frontend with success
    const redirectUrl = `${frontendUrl}/?connected=gmail`;
    console.log("Redirecting to:", redirectUrl);
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error("Unexpected error in gmail-callback:", error);
    const frontendUrl = "https://preview--chief-executive-assistant.lovable.app";
    return redirectWithError(frontendUrl, "unexpected_error");
  }
});
