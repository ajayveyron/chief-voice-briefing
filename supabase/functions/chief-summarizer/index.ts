import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to generate AI summary from raw content
async function generateSummary(content: any, source: string, metadata: any = {}): Promise<{
  summary: string;
  topic: string;
  entities: string[];
  importance: 'low' | 'medium' | 'high';
  llm_model: string;
  version: string;
}> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.warn('OpenAI API key not configured - returning basic summary');
    return {
      summary: `${source} update: ${JSON.stringify(content).substring(0, 100)}...`,
      topic: `${source} Update`,
      entities: [],
      importance: 'low',
      llm_model: 'fallback',
      version: 'v1.0'
    };
  }

  try {
    const prompt = `
You are Chief, an AI executive assistant. Analyze this ${source} content and extract a structured summary.

Content: ${JSON.stringify(content)}
Metadata: ${JSON.stringify(metadata)}

Focus on:
1. Key information and context
2. People, organizations, and important entities mentioned
3. Urgency and importance level
4. Main topic or subject matter

Respond with ONLY valid JSON in this exact format:
{
  "summary": "Brief, clear summary (max 200 chars)",
  "topic": "Main topic or subject",
  "entities": ["person1", "company", "project"],
  "importance": "low|medium|high"
}

Guidelines for importance:
- high: Urgent meetings, critical decisions, deadlines, important people
- medium: Regular work updates, scheduled meetings, project updates
- low: FYI messages, routine communications, low-priority tasks`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return {
      summary: result.summary || `${source} update`,
      topic: result.topic || `${source} Update`,
      entities: result.entities || [],
      importance: result.importance || 'low',
      llm_model: 'gpt-4.1-2025-04-14',
      version: 'v1.0'
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      summary: `${source} update: Error processing content`,
      topic: `${source} Update`,
      entities: [],
      importance: 'low',
      llm_model: 'gpt-4.1-2025-04-14',
      version: 'v1.0-error'
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { raw_event_id, content, source, user_id } = await req.json();

    if (!raw_event_id || !content || !source || !user_id) {
      throw new Error('Missing required parameters: raw_event_id, content, source, user_id');
    }

    console.log(`🔍 Summarizing ${source} content for event ${raw_event_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse content if it's a string
    const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;

    // Generate summary
    const summaryData = await generateSummary(parsedContent, source);

    // Create summary record
    const { data: summary, error: summaryError } = await supabase
      .from('summaries')
      .insert({
        raw_event_id,
        user_id,
        summary: summaryData.summary,
        topic: summaryData.topic,
        entities: summaryData.entities,
        importance: summaryData.importance,
        llm_model_used: summaryData.llm_model,
        model_version: summaryData.version,
        is_viewed: false
      })
      .select()
      .single();

    if (summaryError) {
      throw new Error(`Failed to create summary: ${summaryError.message}`);
    }

    // Log audit trail
    await supabase
      .from('event_audit_log')
      .insert({
        raw_event_id,
        user_id,
        stage: 'summarized',
        status: 'success',
        message: `Generated summary with importance: ${summaryData.importance}`
      });

    console.log(`✅ Summary created for event ${raw_event_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary_id: summary.id,
        summary: summaryData.summary,
        topic: summaryData.topic,
        importance: summaryData.importance,
        entities: summaryData.entities,
        llm_model: summaryData.llm_model,
        version: summaryData.version
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error in Chief Summarizer:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});