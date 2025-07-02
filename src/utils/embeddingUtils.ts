import { supabase } from "@/integrations/supabase/client";

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

export const generateAndStoreEmbedding = async (
  data: EmbeddingData
): Promise<EmbeddingResult> => {
  console.log("🔄 Generating embedding for text...");

  try {
    // Call Supabase Edge Function to generate and store embedding
    const { data: result, error } = await supabase.functions.invoke(
      "generate-embeddings",
      {
        body: {
          user_id: data.user_id,
          source_type: data.source_type,
          source_id: data.source_id,
          content: data.content,
          metadata: data.metadata || {},
        },
      }
    );

    if (error) {
      throw error;
    }

    // Check if the result indicates a skipped duplicate
    if (result?.skipped) {
      console.log("⚠️ Skipping duplicate entry:", data.source_id);
      return {
        ...data,
        embeddingDimensions: 0,
        skipped: true,
        reason: "duplicate",
      };
    }

    console.log("✅ Embedding stored successfully");
    return {
      ...data,
      embeddingDimensions: result?.embeddingDimensions || 0,
      data: result,
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
