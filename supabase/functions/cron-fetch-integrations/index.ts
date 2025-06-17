import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Initialize OpenAI
const configuration = new Configuration({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});
const openai = new OpenAIApi(configuration);

// Helper function to get last fetch time
async function getLastFetchTime(supabaseClient: any, userId: string) {
  const { data } = await supabaseClient
    .from("integration_fetch_logs")
    .select("last_fetch_time")
    .eq("user_id", userId)
    .order("last_fetch_time", { ascending: false })
    .limit(1)
    .single();

  return data?.last_fetch_time || new Date(0).toISOString();
}

// Helper function to update last fetch time
async function updateLastFetchTime(supabaseClient: any, userId: string) {
  await supabaseClient.from("integration_fetch_logs").insert({
    user_id: userId,
    last_fetch_time: new Date().toISOString(),
  });
}

// Helper function to process data through LLM
async function processWithLLM(data: any, source: string) {
  const prompt = `You are an executive assistant summarizing messages and events for your user.

Instructions:
1. Summarize the content clearly.
2. Identify specific action items (meetings, replies, decisions).
3. Suggest intelligent assistant prompts.

Data to process:
${JSON.stringify(data, null, 2)}

Respond in this format:
{
  "summary": "A concise explanation of the message.",
  "action_items": [
    { "type": "calendar_check", "details": "Check availability at 4 PM tomorrow" }
  ],
  "suggestions": [
    { "type": "schedule_meeting", "prompt": "Would you like me to schedule the meeting for 4 PM tomorrow?" }
  ],
  "source": "${source}",
  "timestamp": "${new Date().toISOString()}",
  "is_viewed": false
}`;

  const completion = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return JSON.parse(completion.data.choices[0].message?.content || "{}");
}

// Helper function to fetch Gmail data
async function fetchGmailData(
  supabaseClient: any,
  userId: string,
  lastFetchTime: string
) {
  const { data: integration } = await supabaseClient
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("integration_type", "gmail")
    .eq("is_active", true)
    .single();

  if (!integration?.access_token) return [];

  // Fetch unread emails after last fetch time
  const query = `is:unread -category:{promotions updates forums social} label:inbox after:${
    new Date(lastFetchTime).getTime() / 1000
  }`;
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(
      query
    )}`,
    {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return data.messages || [];
}

// Helper function to fetch Calendar data
async function fetchCalendarData(
  supabaseClient: any,
  userId: string,
  lastFetchTime: string
) {
  const { data: integration } = await supabaseClient
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("integration_type", "calendar")
    .eq("is_active", true)
    .single();

  if (!integration?.access_token) return [];

  const now = new Date();
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${lastFetchTime}&timeMax=${now.toISOString()}&singleEvents=true`,
    {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return data.items || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify cron secret
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all active users
    const { data: users } = await supabaseClient
      .from("users")
      .select("id")
      .eq("is_active", true);

    for (const user of users) {
      try {
        // Get last fetch time for this user
        const lastFetchTime = await getLastFetchTime(supabaseClient, user.id);

        // Fetch new data from all integrations
        const gmailData = await fetchGmailData(
          supabaseClient,
          user.id,
          lastFetchTime
        );
        const calendarData = await fetchCalendarData(
          supabaseClient,
          user.id,
          lastFetchTime
        );

        // Process each item through LLM
        for (const item of [...gmailData, ...calendarData]) {
          const source = gmailData.includes(item) ? "gmail" : "calendar";
          const processedData = await processWithLLM(item, source);

          // Store processed data
          await supabaseClient.from("processed_integration_data").insert({
            user_id: user.id,
            source: source,
            raw_data: item,
            processed_data: processedData,
            created_at: new Date().toISOString(),
          });
        }

        // Update last fetch time
        await updateLastFetchTime(supabaseClient, user.id);
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        // Continue with next user even if one fails
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in cron job:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
