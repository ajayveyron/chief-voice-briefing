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

    // Fetch emails from Gmail API (only unread)
    const gmailQuery =
      "is:unread -category:{promotions updates forums social} label:inbox";
    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=${encodeURIComponent(
        gmailQuery
      )}`,
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
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=${encodeURIComponent(
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
        const emails = [];

        // Process messages...
        for (const message of messagesData.messages || []) {
          const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            {
              headers: {
                Authorization: `Bearer ${integration.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (detailResponse.ok) {
            const emailDetail = await detailResponse.json();

            // Extract subject and sender
            const headers = emailDetail.payload?.headers || [];
            const subject =
              headers.find((h: any) => h.name === "Subject")?.value ||
              "No Subject";
            const from =
              headers.find((h: any) => h.name === "From")?.value ||
              "Unknown Sender";
            const date =
              headers.find((h: any) => h.name === "Date")?.value || "";

            // Extract body text
            let body = "";
            if (emailDetail.payload?.body?.data) {
              body = atob(
                emailDetail.payload.body.data
                  .replace(/-/g, "+")
                  .replace(/_/g, "/")
              );
            } else if (emailDetail.payload?.parts) {
              const textPart = emailDetail.payload.parts.find(
                (part: any) => part.mimeType === "text/plain"
              );
              if (textPart?.body?.data) {
                body = atob(
                  textPart.body.data.replace(/-/g, "+").replace(/_/g, "/")
                );
              }
            }

            emails.push({
              id: message.id,
              subject,
              from,
              date,
              snippet: emailDetail.snippet || "",
              body: body.substring(0, 500), // Limit body length
            });
          }
        }

        return new Response(JSON.stringify({ emails }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gmail API error: ${gmailResponse.status}`);
    }

    const messagesData = await gmailResponse.json();
    const emails = [];

    // Fetch details for each message
    for (const message of messagesData.messages || []) {
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
        {
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (detailResponse.ok) {
        const emailDetail = await detailResponse.json();

        // Extract subject and sender
        const headers = emailDetail.payload?.headers || [];
        const subject =
          headers.find((h: any) => h.name === "Subject")?.value || "No Subject";
        const from =
          headers.find((h: any) => h.name === "From")?.value ||
          "Unknown Sender";
        const date = headers.find((h: any) => h.name === "Date")?.value || "";

        // Extract body text
        let body = "";
        if (emailDetail.payload?.body?.data) {
          body = atob(
            emailDetail.payload.body.data.replace(/-/g, "+").replace(/_/g, "/")
          );
        } else if (emailDetail.payload?.parts) {
          const textPart = emailDetail.payload.parts.find(
            (part: any) => part.mimeType === "text/plain"
          );
          if (textPart?.body?.data) {
            body = atob(
              textPart.body.data.replace(/-/g, "+").replace(/_/g, "/")
            );
          }
        }

        emails.push({
          id: message.id,
          subject,
          from,
          date,
          snippet: emailDetail.snippet || "",
          body: body.substring(0, 500), // Limit body length
        });
      }
    }

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
