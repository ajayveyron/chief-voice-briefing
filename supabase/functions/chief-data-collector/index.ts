import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processGmailData } from './gmail-processor.ts';
import { processCalendarData } from './calendar-processor.ts';
import { processSlackData } from './slack-processor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🤖 Chief Data Collector starting...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process all data sources in parallel
    const [gmailCount, calendarCount, slackCount] = await Promise.all([
      processGmailData(supabase),
      processCalendarData(supabase),
      processSlackData(supabase)
    ]);

    const totalRawEvents = gmailCount + calendarCount + slackCount;
    console.log(`📊 Total raw events collected: ${totalRawEvents}`);

    // Trigger data processor if we have new events
    if (totalRawEvents > 0) {
      console.log('🔄 Triggering data processor for new events...');
      try {
        await supabase.functions.invoke('chief-data-processor');
      } catch (error) {
        console.error('Error triggering data processor:', error);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Chief Data Collector completed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        raw_events_collected: totalRawEvents,
        processing_time_ms: processingTime,
        breakdown: {
          gmail: gmailCount,
          calendar: calendarCount,
          slack: slackCount
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error in Chief Data Collector:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});