import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to generate AI summary and suggestions
async function processWithLLM(content: any, source: string): Promise<{
  summary: string;
  topic: string;
  entities: string[];
  importance: 'low' | 'medium' | 'high';
  suggestions: Array<{
    type: string;
    prompt: string;
    confidence_score: number;
    requires_confirmation: boolean;
    payload: any;
  }>;
}> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.warn('OpenAI API key not configured - returning basic processing');
    return {
      summary: `${source} update: ${JSON.stringify(content).substring(0, 100)}...`,
      topic: `${source} Update`,
      entities: [],
      importance: 'low',
      suggestions: []
    };
  }

  try {
    const prompt = `
You are Chief, an AI executive assistant. Analyze this ${source} data and provide structured output.

Data: ${JSON.stringify(content)}

Respond with ONLY valid JSON in this exact format:
{
  "summary": "Brief summary of the content (max 200 chars)",
  "topic": "Main topic or subject",
  "entities": ["person1", "company", "project"],
  "importance": "low|medium|high",
  "suggestions": [
    {
      "type": "action_type",
      "prompt": "Natural language suggestion",
      "confidence_score": 0.85,
      "requires_confirmation": true,
      "payload": {"key": "value"}
    }
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
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
      suggestions: result.suggestions || []
    };
  } catch (error) {
    console.error('Error processing with LLM:', error);
    return {
      summary: `${source} update: ${JSON.stringify(content).substring(0, 100)}...`,
      topic: `${source} Update`,
      entities: [],
      importance: 'low',
      suggestions: []
    };
  }
}

// Function to process raw events into summaries and suggestions
async function processRawEvents(supabase: any): Promise<number> {
  console.log('🔄 Processing raw events...');
  let processedCount = 0;

  try {
    // Get unprocessed raw events
    const { data: rawEvents, error } = await supabase
      .from('raw_events')
      .select('*')
      .eq('status', 'raw')
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (error) {
      console.error('Error fetching raw events:', error);
      return 0;
    }

    console.log(`📊 Found ${rawEvents?.length || 0} raw events to process`);

    for (const rawEvent of rawEvents || []) {
      try {
        console.log(`Processing event ${rawEvent.id} from ${rawEvent.source}`);
        
        // Parse content
        const content = JSON.parse(rawEvent.content);
        
        // Process with LLM
        const processed = await processWithLLM(content, rawEvent.source);
        
        // Create summary
        const { data: summary, error: summaryError } = await supabase
          .from('summaries')
          .insert({
            raw_event_id: rawEvent.id,
            user_id: rawEvent.user_id,
            summary: processed.summary,
            topic: processed.topic,
            entities: processed.entities,
            importance: processed.importance,
            llm_model_used: 'gpt-4o-mini',
            model_version: 'v1.0',
            is_viewed: false
          })
          .select()
          .single();

        if (summaryError) {
          console.error('Error creating summary:', summaryError);
          continue;
        }

        // Create suggestions
        for (const suggestion of processed.suggestions) {
          await supabase
            .from('llm_suggestions')
            .insert({
              summary_id: summary.id,
              user_id: rawEvent.user_id,
              type: suggestion.type,
              prompt: suggestion.prompt,
              confidence_score: suggestion.confidence_score,
              requires_confirmation: suggestion.requires_confirmation,
              payload: suggestion.payload
            });
        }

        // Mark raw event as processed
        await supabase
          .from('raw_events')
          .update({ status: 'processed' })
          .eq('id', rawEvent.id);

        // Log audit trail
        await supabase
          .from('event_audit_log')
          .insert({
            raw_event_id: rawEvent.id,
            user_id: rawEvent.user_id,
            stage: 'summarized',
            status: 'success',
            message: `Generated summary and ${processed.suggestions.length} suggestions`
          });

        processedCount++;
        console.log(`✅ Processed event ${rawEvent.id}`);

      } catch (error) {
        console.error(`Error processing event ${rawEvent.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('raw_events')
          .update({ status: 'failed' })
          .eq('id', rawEvent.id);

        // Log failure
        await supabase
          .from('event_audit_log')
          .insert({
            raw_event_id: rawEvent.id,
            user_id: rawEvent.user_id,
            stage: 'summarized',
            status: 'failed',
            message: error.message
          });
      }
    }
  } catch (error) {
    console.error('Error in processRawEvents:', error);
  }

  return processedCount;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🤖 Chief Data Processor starting...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process raw events into summaries and suggestions
    const processedCount = await processRawEvents(supabase);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Chief Data Processor completed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        events_processed: processedCount,
        processing_time_ms: processingTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error in Chief Data Processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});