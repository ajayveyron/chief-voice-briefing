
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testing chief-integration-cron execution...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Execute the chief-integration-cron function
    const { data, error } = await supabase.functions.invoke('chief-integration-cron', {
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Chief Integration Cron Results:');
    console.log('✅ Success:', !error);
    console.log('📋 Data:', JSON.stringify(data, null, 2));
    
    if (error) {
      console.log('❌ Error:', JSON.stringify(error, null, 2));
    }

    // Also check what integrations exist
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('is_active', true);

    console.log('🔍 Active Integrations Check:');
    console.log('✅ Query Success:', !intError);
    console.log('📋 Active Integrations:', JSON.stringify(integrations, null, 2));
    
    if (intError) {
      console.log('❌ Integration Query Error:', JSON.stringify(intError, null, 2));
    }

    // Check if any raw events were created
    const { data: rawEvents, error: rawError } = await supabase
      .from('raw_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('📄 Recent Raw Events:');
    console.log('✅ Query Success:', !rawError);
    console.log('📋 Raw Events:', JSON.stringify(rawEvents, null, 2));

    return new Response(
      JSON.stringify({
        success: !error,
        cronResult: data,
        cronError: error,
        activeIntegrations: integrations,
        integrationError: intError,
        recentRawEvents: rawEvents,
        rawEventsError: rawError
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Test execution error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
