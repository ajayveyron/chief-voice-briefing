import { pipeline } from "@huggingface/transformers";
import { supabase } from "@/integrations/supabase/client";

export interface EmbeddingData {
  user_id: string;
  source_type: string;
  source_id: string;
  content: string;
  metadata?: any;
}

export const generateAndStoreEmbedding = async (data: EmbeddingData) => {
  console.log("🔄 Initializing embedding pipeline...");

  // Generate embedding using Hugging Face transformers
  const generateEmbedding = await pipeline(
    "feature-extraction",
    "Supabase/gte-small"
  );

  console.log("🔄 Generating embedding for text...");

  // Generate a vector using Transformers.js
  const output = await generateEmbedding(data.content, {
    pooling: "mean",
    normalize: true,
  });

  // Extract the embedding output and convert to array
  const embeddingArray = Array.from(output.data);
  console.log("✅ Embedding generated:", embeddingArray.length, "dimensions");

  // Store the vector in the embeddings table
  const { data: insertData, error: insertError } = await supabase
    .from("embeddings")
    .insert({
      user_id: data.user_id,
      source_type: data.source_type,
      source_id: data.source_id,
      content: data.content,
      metadata: data.metadata || {},
      embedding: embeddingArray,
    });

  if (insertError) {
    throw insertError;
  }

  console.log("✅ Embedding stored successfully");
  return {
    ...data,
    embeddingDimensions: embeddingArray.length,
    data: insertData,
  };
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

export const formatCalendarForEmbedding = (events: any[]): EmbeddingData[] => {
  return events.map((event) => ({
    title: `Calendar: ${event.summary || "Untitled Event"}`,
    body: `Event: ${event.summary || "Untitled Event"}\nLocation: ${
      event.location || "No location"
    }\nDescription: ${event.description || "No description"}`,
  }));
};

export const formatSlackForEmbedding = (messages: any[]): EmbeddingData[] => {
  return messages.map((message) => ({
    title: `Slack: ${
      message.channel_name ? `#${message.channel_name}` : "Direct Message"
    }`,
    body: `Channel: ${message.channel_name || "Direct Message"}\nUser: ${
      message.username || "Unknown"
    }\nMessage: ${message.text || ""}`,
  }));
};

export const formatNotionForEmbedding = (pages: any[]): EmbeddingData[] => {
  return pages.map((page) => ({
    title: `Notion: ${page.title || "Untitled Page"}`,
    body: `Page: ${page.title || "Untitled Page"}\nCreated: ${
      page.created_time
    }\nArchived: ${page.archived ? "Yes" : "No"}`,
  }));
};
