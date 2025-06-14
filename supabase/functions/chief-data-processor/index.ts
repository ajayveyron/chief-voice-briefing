import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to process raw events through the separated LLM pipeline
async function processRawEvents(supabase: any): Promise<number> {
  console.log('🔄 Processing raw events through separated LLM pipeline...');
  let processedCount = 0;

  try {
    // Get unprocessed raw events
    const { data: rawEvents, error } = await supabase
      .from('raw_events')
      .select('*')
      .eq('status', 'raw')
      .order('created_at', { ascending: true })
      .limit(20); // Process in smaller batches for better reliability

    if (error) {
      console.error('Error fetching raw events:', error);
      return 0;
    }

    console.log(`📊 Found ${rawEvents?.length || 0} raw events to process`);

    for (const rawEvent of rawEvents || []) {
      try {
        console.log(`Processing event ${rawEvent.id} from ${rawEvent.source}`);
        
        // Stage 1: Generate Summary using dedicated summarizer
        console.log(`📝 Stage 1: Summarizing event ${rawEvent.id}`);
        const { data: summaryResult, error: summaryError } = await supabase.functions.invoke('chief-summarizer', {
          body: {
            raw_event_id: rawEvent.id,
            content: rawEvent.content,
            source: rawEvent.source,
            user_id: rawEvent.user_id
          }
        });

        if (summaryError) {
          console.error('Error in summarizer:', summaryError);
          await supabase
            .from('raw_events')
            .update({ status: 'failed' })
            .eq('id', rawEvent.id);
          continue;
        }

        // Stage 2: Generate Action Suggestions using dedicated action suggester
        console.log(`🎯 Stage 2: Generating actions for summary ${summaryResult.summary_id}`);
        const { data: actionResult, error: actionError } = await supabase.functions.invoke('chief-action-suggester', {
          body: {
            summary_id: summaryResult.summary_id,
            summary: summaryResult.summary,
            topic: summaryResult.topic,
            source: rawEvent.source,
            original_content: JSON.parse(rawEvent.content),
            user_id: rawEvent.user_id,
            user_context: {} // TODO: Add user context from preferences/calendar
          }
        });

        if (actionError) {
          console.error('Error in action suggester:', actionError);
          // Don't fail the whole process if action suggestion fails
          await supabase
            .from('event_audit_log')
            .insert({
              raw_event_id: rawEvent.id,
              user_id: rawEvent.user_id,
              stage: 'action_suggested',
              status: 'failed',
              message: actionError.message
            });
        }

        // Mark raw event as processed
        await supabase
          .from('raw_events')
          .update({ status: 'processed' })
          .eq('id', rawEvent.id);

        // Final audit log
        await supabase
          .from('event_audit_log')
          .insert({
            raw_event_id: rawEvent.id,
            user_id: rawEvent.user_id,
            stage: 'completed',
            status: 'success',
            message: `Completed processing: Summary created, ${actionResult?.suggestions_created || 0} actions suggested`
          });

        processedCount++;
        console.log(`✅ Completed processing event ${rawEvent.id}`);

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
            stage: 'processing',
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