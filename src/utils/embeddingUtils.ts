import { supabase } from "@/integrations/supabase/client";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


// OpenAI Configuration
const OPENAI_API_KEY =  Deno.env.get("OPENAI_API_KEY");
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

export interface EmbeddingData {
  user_id: string;
  source_type: string;
  source_id: string;
  content: string;
  metadata?: any;
}

export interface EmbeddingResult {
  user_id: string;
  source_type: string;
  source_id: string;
  content: string;
  metadata?: any;
  embeddingDimensions: number;
  data?: any;
  skipped?: boolean;
  reason?: string;
}

export const checkEmbeddingExists = async (
  user_id: string,
  source_type: string,
  source_id: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("embeddings")
    .select("id")
    .eq("user_id", user_id)
    .eq("source_type", source_type)
    .eq("source_id", source_id)
    .limit(1);

  if (error) {
    console.error("Error checking embedding existence:", error);
    return false;
  }

  return data && data.length > 0;
};

const generateEmbedding = async (text: string): Promise<number[]> => {
  console.log("🔄 Generating OpenAI embedding...");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;
  
  if (!embedding) {
    throw new Error("No embedding returned from OpenAI");
  }

  return embedding;
};

export const generateAndStoreEmbedding = async (
  data: EmbeddingData
): Promise<EmbeddingResult> => {
  console.log("🔄 Generating embedding for text...");

  try {
    // Generate embedding using OpenAI API
    const embeddingArray = await generateEmbedding(data.content);
    console.log("✅ Embedding generated:", embeddingArray.length, "dimensions");

    // Store the vector in the embeddings table using upsert to handle duplicates
    const { data: insertData, error: insertError } = await (supabase as any)
      .from("embeddings")
      .upsert(
        {
          user_id: data.user_id,
          source_type: data.source_type,
          source_id: data.source_id,
          content: data.content,
          metadata: data.metadata || {},
          embedding: embeddingArray,
        },
        {
          onConflict: "user_id,source_type,source_id",
        }
      );

    if (insertError) {
      // Check if it's a duplicate key error and handle gracefully
      if (
        insertError.code === "23505" &&
        insertError.message.includes(
          "duplicate key value violates unique constraint"
        )
      ) {
        console.log("⚠️ Skipping duplicate entry:", data.source_id);
        return {
          ...data,
          embeddingDimensions: embeddingArray.length,
          skipped: true,
          reason: "duplicate",
        };
      }
      throw insertError;
    }

    console.log("✅ Embedding stored successfully");
    return {
      ...data,
      embeddingDimensions: embeddingArray.length,
      data: insertData,
    };
  } catch (error) {
    console.error("Error generating or storing embedding:", error);
    throw error;
  }
};

export const formatGmailForEmbedding = (
  emails: any[],
  user_id?: string
): EmbeddingData[] => {
  return emails.map((email) => ({
    user_id: user_id || email.user_id || "",
    source_type: "gmail",
    source_id: email.id,
    content: `From: ${email.from}\nSubject: ${
      email.subject || "No Subject"
    }\n\n${email.snippet || email.body || ""}`,
    metadata: {
      subject: email.subject,
      from: email.from,
      date: email.date,
      snippet: email.snippet,
    },
  }));
};

export const formatCalendarForEmbedding = (
  events: any[],
  user_id: string
): EmbeddingData[] => {
  return events.map((event) => ({
    user_id,
    source_type: "calendar",
    source_id: event.id || event.summary || "unknown",
    content: `Event: ${event.summary || "Untitled Event"}\nLocation: ${
      event.location || "No location"
    }\nDescription: ${event.description || "No description"}`,
    metadata: {
      summary: event.summary,
      location: event.location,
      description: event.description,
    },
  }));
};

export const formatSlackForEmbedding = (
  messages: any[],
  user_id: string
): EmbeddingData[] => {
  return messages.map((message) => ({
    user_id,
    source_type: "slack",
    source_id: message.id || message.ts || "unknown",
    content: `Channel: ${message.channel_name || "Direct Message"}\nUser: ${
      message.username || "Unknown"
    }\nMessage: ${message.text || ""}`,
    metadata: {
      channel_name: message.channel_name,
      username: message.username,
      text: message.text,
    },
  }));
};

export const formatNotionForEmbedding = (
  pages: any[],
  user_id: string
): EmbeddingData[] => {
  return pages.map((page) => ({
    user_id,
    source_type: "notion",
    source_id: page.id,
    content: `Page: ${page.title || "Untitled Page"}\nCreated: ${
      page.created_time
    }\nArchived: ${page.archived ? "Yes" : "No"}`,
    metadata: {
      title: page.title,
      created_time: page.created_time,
      archived: page.archived,
    },
  }));
};