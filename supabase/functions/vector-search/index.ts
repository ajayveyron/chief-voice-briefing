import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "sk-...";
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cosine similarity function
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Vector search function called");

    const body = await req.json();
    const { query, user_id, source_type, topK = 5 } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate embedding for the query
    const openaiRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: query,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: "OpenAI error", details: err }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiData = await openaiRes.json();
    const queryEmbedding = openaiData.data?.[0]?.embedding;

    if (!queryEmbedding) {
      return new Response(
        JSON.stringify({ error: "No embedding returned from OpenAI" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role key to fetch embeddings
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build the query to get all embeddings for the user
    let queryBuilder = supabase
      .from("embeddings")
      .select(
        "id, source_type, source_id, content, metadata, created_at, embedding"
      )
      .eq("user_id", user_id);

    if (source_type) {
      queryBuilder = queryBuilder.eq("source_type", source_type);
    }

    const { data: allEmbeddings, error: searchError } = await queryBuilder;

    if (searchError) {
      console.error("Search error:", searchError);
      return new Response(JSON.stringify({ error: searchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allEmbeddings || allEmbeddings.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          message: "No embeddings found for this user",
          query: query,
          user_id: user_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate similarity scores for all embeddings
    const resultsWithSimilarity = allEmbeddings
      .map((result) => {
        if (!result.embedding) {
          console.log("Skipping result with no embedding:", result.id);
          return null;
        }

        // Ensure embedding is an array of numbers
        let embeddingArray: number[];
        if (typeof result.embedding === "string") {
          try {
            embeddingArray = JSON.parse(result.embedding);
          } catch (e) {
            console.log("Failed to parse embedding string:", result.id);
            return null;
          }
        } else if (Array.isArray(result.embedding)) {
          embeddingArray = result.embedding;
        } else {
          console.log(
            "Invalid embedding format:",
            result.id,
            typeof result.embedding
          );
          return null;
        }

        // Validate embedding dimensions
        if (embeddingArray.length !== queryEmbedding.length) {
          console.log(
            "Embedding dimension mismatch:",
            embeddingArray.length,
            "vs",
            queryEmbedding.length
          );
          return null;
        }

        const similarity = cosineSimilarity(queryEmbedding, embeddingArray);
        console.log(
          "Similarity for",
          result.id,
          ":",
          similarity,
          "Content preview:",
          result.content.substring(0, 50)
        );

        return {
          ...result,
          similarity: Math.max(0, similarity), // Ensure non-negative
        };
      })
      .filter((result) => result !== null) // Remove null results
      .filter((result) => result.similarity > 0.1) // Only include results with meaningful similarity
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity (highest first)
      .slice(0, topK); // Get top K results

    console.log("Final results count:", resultsWithSimilarity.length);
    console.log(
      "Top similarity scores:",
      resultsWithSimilarity.map((r) => r.similarity)
    );

    return new Response(
      JSON.stringify({
        results: resultsWithSimilarity,
        message: "Vector search completed successfully",
        query: query,
        user_id: user_id,
        total_embeddings: allEmbeddings.length,
        top_k: topK,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Vector search error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
