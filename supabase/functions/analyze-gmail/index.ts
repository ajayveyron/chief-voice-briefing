import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Email {
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  from?: string;
}

interface AnalysisData {
  sent_emails: Email[];
  received_emails: Email[];
}

interface Contact {
  name: string;
  email: string;
  role?: string;
  company?: string;
  context?: string;
  frequency: number;
}

interface UserPreferences {
  writing_style: string;
  tone: string;
  length_preference: string;
  formality_level: string;
  communication_patterns: string[];
  common_topics: string[];
}

interface AnalysisResult {
  preferences: UserPreferences;
  contacts: Contact[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { emails, user_id } = await req.json();

    if (!emails || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract user replies from received emails and add them to sent emails
    const extractedReplies = emails.received_emails.flatMap((email) => {
      const matches = email.body?.match(
        /On .*?Ajay Pawriya <ajayveyron9@gmail\.com> wrote:\s*>((.|\n)*?)(\n>|\n--|\nOn|\n$)/
      );
      if (matches) {
        return [
          {
            subject: email.subject,
            snippet: email.snippet,
            body: matches[1].replace(/^> ?/gm, "").trim(),
            date: email.date,
            from: "ajayveyron9@gmail.com",
          },
        ];
      }
      return [];
    });

    // Combine original sent emails with extracted replies
    const allSentEmails = [...emails.sent_emails, ...extractedReplies];

    // Prepare the prompt for ChatGPT
    const prompt = `
Analyze the following Gmail data to extract user preferences and contacts. Return the response in JSON format.

SENT EMAILS (analyze for user preferences when sending or replying to emails - writing style, tone, length, etc.):
${allSentEmails
  .map(
    (email) => `
From: ajayveyron9@gmail.com
Subject: ${email.subject}
Snippet: ${email.snippet}
Body: ${email.body || ""}
Date: ${email.date}
`
  )
  .join("\n")}

RECEIVED EMAILS (analyze for contacts - who they are, their role, company, context):
${emails.received_emails
  .map(
    (email) => `
From: ${email.from}
Subject: ${email.subject}
Snippet: ${email.snippet}
Body: ${email.body || ""}
Date: ${email.date}
`
  )
  .join("\n")}

IMPORTANT: You MUST return a valid JSON object with EXACTLY this structure:

{
  "preferences": {
    "writing_style": "Brief description of writing style (e.g., concise, detailed, formal, casual)",
    "tone": "Overall tone in communications (e.g., professional, friendly, direct)",
    "length_preference": "Typical email length preference (e.g., short, medium, long)",
    "formality_level": "Formality level (e.g., formal, semi-formal, casual)",
    "communication_patterns": ["pattern1", "pattern2", "pattern3"],
    "common_topics": ["topic1", "topic2", "topic3"]
  },
  "contacts": [
    {
      "name": "Contact Name",
      "email": "email@example.com",
      "role": "Their role/title if identifiable",
      "company": "Company name if identifiable",
      "context": "Brief context about relationship or communication history",
      "frequency": 1
    }
  ]
}

Guidelines:
- For preferences: Focus on sent emails to understand the user's communication style. Some replies from the user may be present within the body of received emails (quoted format). Please extract user replies if you see blocks like:
"On [date], Ajay Pawriya <ajayveyron9@gmail.com> wrote:" Use those sections as part of SENT EMAILS for inferring preferences.
- For contacts: Analyze received emails to identify *only real human contacts*
- Ignore automated, system, support, notification, marketing, noreply, or platform addresses
- Prioritize people the user has exchanged multiple messages with or who show signs of ongoing interaction
- Be specific but concise in descriptions
- Use "Unknown" if the role/company/context cannot be inferred
- For frequency, count how many emails from each contact
- Group similar contacts and combine their information
- If no sent emails exist, still return the preferences structure with "Unable to determine" values
- If no received emails exist, return an empty contacts array
- DO NOT include any text before or after the JSON object
`;

    // Call OpenAI API
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not found in environment variables");
    }

    console.log("OpenAI API Key length:", openaiApiKey.length);
    console.log(
      "OpenAI API Key starts with:",
      openaiApiKey.substring(0, 7) + "..."
    );

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o", // Fallback to 3.5-turbo if gpt-4 is not available
          messages: [
            {
              role: "system",
              content:
                "You are an expert at analyzing email communication patterns and extracting user preferences and contact information. Return only valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API Error Details:", {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        response: errorText,
      });
      throw new Error(
        `OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText} - ${errorText}`
      );
    }

    const openaiData = await openaiResponse.json();
    const analysisText = openaiData.choices[0]?.message?.content;

    if (!analysisText) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let analysisResult: AnalysisResult;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      analysisResult = JSON.parse(jsonMatch[0]);

      console.log(
        "Parsed analysis result:",
        JSON.stringify(analysisResult, null, 2)
      );
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", analysisText);
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Validate and handle the structure
    if (!analysisResult.preferences || !analysisResult.contacts) {
      console.error("Invalid structure. Full response:", analysisResult);

      // Handle case where there are no sent emails - provide default preferences
      if (allSentEmails.length === 0) {
        analysisResult = {
          preferences: {
            writing_style: "Unable to determine - no sent emails found",
            tone: "Unable to determine - no sent emails found",
            length_preference: "Unable to determine - no sent emails found",
            formality_level: "Unable to determine - no sent emails found",
            communication_patterns: ["No sent emails available for analysis"],
            common_topics: ["No sent emails available for analysis"],
          },
          contacts: analysisResult.contacts || [],
        };
      } else {
        // If there are sent emails but structure is still invalid, provide defaults
        analysisResult = {
          preferences: analysisResult.preferences || {
            writing_style: "Unable to determine",
            tone: "Unable to determine",
            length_preference: "Unable to determine",
            formality_level: "Unable to determine",
            communication_patterns: ["Unable to determine"],
            common_topics: ["Unable to determine"],
          },
          contacts: analysisResult.contacts || [],
        };
      }
    }

    // Store results in Supabase if tables exist
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      console.log("Attempting to store preferences for user:", user_id);
      console.log(
        "Supabase URL:",
        Deno.env.get("SUPABASE_URL") ? "Set" : "Not set"
      );
      console.log(
        "Service role key:",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "Set" : "Not set"
      );

      // Store preferences - bypass RLS for service role
      const { data: prefData, error: prefError } = await supabaseClient
        .from("user_preferences")
        .upsert(
          {
            user_id: user_id,
            writing_style: analysisResult.preferences.writing_style,
            tone: analysisResult.preferences.tone,
            length_preference: analysisResult.preferences.length_preference,
            formality_level: analysisResult.preferences.formality_level,
            communication_patterns:
              analysisResult.preferences.communication_patterns,
            common_topics: analysisResult.preferences.common_topics,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (prefError) {
        console.error("Error storing preferences:", prefError);
        console.error("Error details:", {
          code: prefError.code,
          message: prefError.message,
          details: prefError.details,
          hint: prefError.hint,
        });
      } else {
        console.log("Successfully stored preferences:", prefData);
      }

      // Store contacts - bypass RLS for service role
      console.log(
        "Attempting to store",
        analysisResult.contacts.length,
        "contacts"
      );

      // First, delete existing contacts for this user to avoid duplicates
      const { error: deleteError } = await supabaseClient
        .from("contacts")
        .delete()
        .eq("user_id", user_id);

      if (deleteError) {
        console.error("Error deleting existing contacts:", deleteError);
      } else {
        console.log("Deleted existing contacts for user:", user_id);
      }

      // Insert new contacts
      if (analysisResult.contacts.length > 0) {
        const contactsToInsert = analysisResult.contacts.map((contact) => ({
          user_id: user_id,
          name: contact.name,
          email: contact.email,
          role: contact.role || null,
          company: contact.company || null,
          context: contact.context || null,
          frequency: contact.frequency || 1,
          updated_at: new Date().toISOString(),
        }));

        const { data: contactsData, error: contactsError } =
          await supabaseClient.from("contacts").insert(contactsToInsert);

        if (contactsError) {
          console.error("Error storing contacts:", contactsError);
          console.error("Error details:", {
            code: contactsError.code,
            message: contactsError.message,
            details: contactsError.details,
            hint: contactsError.hint,
          });
        } else {
          console.log("Successfully stored contacts:", contactsData);
        }
      } else {
        console.log("No contacts to store");
      }

      console.log("Analysis results stored successfully");
    } catch (dbError) {
      console.error("Database error:", dbError);
      console.error("Database error details:", {
        name: dbError.name,
        message: dbError.message,
        stack: dbError.stack,
      });
      // Continue even if database storage fails
    }

    return new Response(JSON.stringify(analysisResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
