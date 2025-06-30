// Gmail data processing
import { logSyncStatus } from "./sync-logger.ts";
import { storeRawEvent } from "./raw-events-storage.ts";

// Function to fetch and process Gmail emails
export async function processGmailData(supabase: any): Promise<number> {
  console.log("🔄 Processing Gmail data...");
  let totalProcessed = 0;

  try {
    // Get all active Gmail integrations
    const { data: integrations, error: intError } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("integration_type", "gmail")
      .eq("is_active", true);

    if (intError) {
      console.error("Error fetching Gmail integrations:", intError);
      return 0;
    }

    console.log(`📧 Found ${integrations?.length || 0} Gmail integrations`);

    for (const integration of integrations || []) {
      try {
        await logSyncStatus(
          supabase,
          integration.id,
          "polling",
          "success",
          null,
          {
            started_at: new Date().toISOString(),
          }
        );

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
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
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
              await supabase
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

        // Fetch emails directly from Gmail API
        const gmailResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=-category:{promotions updates forums social}&labelIds=INBOX",
          {
            headers: {
              Authorization: `Bearer ${integration.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!gmailResponse.ok) {
          if (gmailResponse.status === 401) {
            await refreshTokenIfExpired();
            // Retry after refresh
            const retryResponse = await fetch(
              "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=-category:{promotions updates forums social}&labelIds=INBOX",
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

            console.log(
              `📧 Processing ${emails.length} emails for user ${integration.user_id}`
            );

            for (const email of emails) {
              const rawEvent = await storeRawEvent(
                supabase,
                integration.id,
                integration.user_id,
                "gmail",
                "email",
                email,
                email.id
              );

              if (rawEvent) {
                totalProcessed++;

                // Debug log before embedding call
                console.log(
                  "📨 Attempting to create embedding for email:",
                  email.id
                );
                try {
                  const embedRes = await fetch(
                    "https://xxccvppbxnhowncdhvdi.functions.supabase.co/generate-embeddings",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get(
                          "SUPABASE_SERVICE_ROLE_KEY"
                        )}`,
                      },
                      body: JSON.stringify({
                        user_id: integration.user_id,
                        source_type: "gmail",
                        source_id: email.id,
                        content: `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`,
                        metadata: {
                          subject: email.subject,
                          from: email.from,
                          date: email.date,
                          snippet: email.snippet,
                        },
                      }),
                    }
                  );
                  const embedResult = await embedRes.text();
                  console.log("📨 Embedding function response:", embedResult);
                } catch (err) {
                  console.error("❌ Error calling embedding function:", err);
                }
              }
            }
            continue;
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

        console.log(
          `📧 Processing ${emails.length} emails for user ${integration.user_id}`
        );

        for (const email of emails) {
          const rawEvent = await storeRawEvent(
            supabase,
            integration.id,
            integration.user_id,
            "gmail",
            "email",
            email,
            email.id
          );

          if (rawEvent) {
            totalProcessed++;

            // Debug log before embedding call
            console.log(
              "📨 Attempting to create embedding for email:",
              email.id
            );
            try {
              const embedRes = await fetch(
                "https://xxccvppbxnhowncdhvdi.functions.supabase.co/generate-embeddings",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Deno.env.get(
                      "SUPABASE_SERVICE_ROLE_KEY"
                    )}`,
                  },
                  body: JSON.stringify({
                    user_id: integration.user_id,
                    source_type: "gmail",
                    source_id: email.id,
                    content: `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`,
                    metadata: {
                      subject: email.subject,
                      from: email.from,
                      date: email.date,
                      snippet: email.snippet,
                    },
                  }),
                }
              );
              const embedResult = await embedRes.text();
              console.log("📨 Embedding function response:", embedResult);
            } catch (err) {
              console.error("❌ Error calling embedding function:", err);
            }
          }
        }

        await logSyncStatus(
          supabase,
          integration.id,
          "polling",
          "success",
          null,
          {
            emails_processed: emails.length,
            completed_at: new Date().toISOString(),
          }
        );
      } catch (error) {
        console.error(
          `Error processing Gmail for user ${integration.user_id}:`,
          error
        );
        await logSyncStatus(
          supabase,
          integration.id,
          "polling",
          "error",
          error.message
        );
      }
    }
  } catch (error) {
    console.error("Error in Gmail processing:", error);
  }

  return totalProcessed;
}
