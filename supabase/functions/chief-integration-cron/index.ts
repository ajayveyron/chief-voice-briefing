
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processIntegration } from './integration-processor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Chief Integration Cron started at:', new Date().toISOString());

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integrations, error: integrationsError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('is_active', true);

    if (integrationsError) {
      console.error('❌ Error fetching integrations:', integrationsError);
      throw integrationsError;
    }

    console.log(`📊 Found ${integrations?.length || 0} active integrations`);

    if (!integrations || integrations.length === 0) {
      console.log('✅ No active integrations found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active integrations found',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;

    for (const integration of integrations) {
      await processIntegration(integration, supabase);
      processedCount++;
    }

    console.log(`✅ Chief Integration Cron completed. Processed ${processedCount} integrations`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Integration cron completed successfully',
      processed: processedCount,
      total_integrations: integrations.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in Chief Integration Cron:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
