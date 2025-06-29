import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Gmail integration
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("integration_type", "gmail")
      .eq("is_active", true)
      .single();

    if (!integration || !integration.access_token) {
      return new Response(JSON.stringify({ error: "Gmail not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Function to refresh token if needed
    async function refreshTokenIfExpired() {
      const now = new Date();
      const expiresAt = new Date(integration.token_expires_at);

      if (now >= expiresAt && integration.refresh_token) {
        console.log("Token expired, refreshing...");

        const refreshResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
              client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
              refresh_token: integration.refresh_token,
              grant_type: "refresh_token",
            }),
          }
        );

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          integration.access_token = tokens.access_token;
          integration.token_expires_at = new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString();

          // Update in database
          await supabaseClient
            .from("user_integrations")
            .update({
              access_token: tokens.access_token,
              token_expires_at: integration.token_expires_at,
              updated_at: new Date().toISOString(),
            })
            .eq("id", integration.id);

          console.log("Token refreshed successfully");
        } else {
          throw new Error("Failed to refresh token");
        }
      }
    }

    await refreshTokenIfExpired();

    // Improved Gmail query to get latest unread emails first
    const gmailQuery =
      "is:unread in:inbox -category:{promotions social updates forums}";
    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30`,
      {
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!gmailResponse.ok) {
      if (gmailResponse.status === 401) {
        // Try to refresh token and retry once
        await refreshTokenIfExpired();
        const retryResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${encodeURIComponent(
            gmailQuery
          )}`,
          {
            headers: {
              Authorization: `Bearer ${integration.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!retryResponse.ok) {
          throw new Error(
            `Gmail API error after refresh: ${retryResponse.status}`
          );
        }

        const messagesData = await retryResponse.json();
        const emails = await processMessages(
          messagesData.messages || [],
          integration.access_token
        );
        return new Response(JSON.stringify({ emails }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gmail API error: ${gmailResponse.status}`);
    }

    const messagesData = await gmailResponse.json();
    const emails = await processMessages(
      messagesData.messages || [],
      integration.access_token
    );

    return new Response(JSON.stringify({ emails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching Gmail emails:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper function to process messages and extract relevant data
async function processMessages(messages: any[], accessToken: string) {
  const emails = [];

  // Process messages in parallel for better performance
  await Promise.all(
    messages.map(async (message) => {
      try {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (detailResponse.ok) {
          const emailDetail = await detailResponse.json();

          // Extract subject, sender, and date
          const headers = emailDetail.payload?.headers || [];
          const subject =
            headers.find((h: any) => h.name === "Subject")?.value ||
            "No Subject";
          const from =
            headers.find((h: any) => h.name === "From")?.value ||
            "Unknown Sender";
          const date = headers.find((h: any) => h.name === "Date")?.value || "";

          // Get the full message if we need more details
          const fullMessageResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          let body = "";
          if (fullMessageResponse.ok) {
            const fullMessage = await fullMessageResponse.json();
            body = extractEmailBody(fullMessage);
          }

          emails.push({
            id: message.id,
            subject,
            from,
            date,
            snippet: emailDetail.snippet || "",
            body: body.substring(0, 1000), // Increased limit for better context
          });
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
      }
    })
  );

  // Sort emails by date (newest first)
  emails.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return emails;
}

// Helper function to extract email body from different parts
function extractEmailBody(message: any): string {
  if (!message.payload) return "";

  // Handle simple emails with direct body
  if (message.payload.body?.data) {
    return decodeBase64(message.payload.body.data);
  }

  // Handle multipart emails
  if (message.payload.parts) {
    // Find the text/plain part first
    const textPart = message.payload.parts.find(
      (part: any) => part.mimeType === "text/plain"
    );
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data);
    }

    // Fallback to text/html if no plain text
    const htmlPart = message.payload.parts.find(
      (part: any) => part.mimeType === "text/html"
    );
    if (htmlPart?.body?.data) {
      // Simple HTML to text conversion (remove tags)
      const html = decodeBase64(htmlPart.body.data);
      return html.replace(/<[^>]*>/g, " ");
    }
  }

  return "";
}

// Helper function to decode base64 email content
function decodeBase64(data: string): string {
  try {
    return atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  } catch (error) {
    console.error("Error decoding base64:", error);
    return "";
  }
}
