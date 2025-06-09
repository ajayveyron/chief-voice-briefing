
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔧 Setting up Chief cron job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !anonKey) {
      throw new Error('Missing required environment variables');
    }

    // Create cron job to run every 5 minutes
    const { data, error } = await supabase
      .rpc('cron_schedule', {
        job_name: 'chief-data-collector',
        schedule: '*/5 * * * *', // Every 5 minutes
        command: `
          select
            net.http_post(
                url:='${supabaseUrl}/functions/v1/chief-data-collector',
                headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
                body:=concat('{"timestamp": "', now(), '"}')::jsonb
            ) as request_id;
        `
      });

    if (error) {
      console.error('Error setting up cron job:', error);
      throw error;
    }

    console.log('✅ Chief cron job setup completed');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Chief cron job has been set up to run every 5 minutes',
        job_name: 'chief-data-collector',
        schedule: '*/5 * * * *'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error setting up Chief cron job:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
