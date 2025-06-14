import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CronJob {
  name: string;
  schedule: string;
  function_name: string;
  description: string;
}

const CRON_JOBS: CronJob[] = [
  {
    name: 'chief-data-collection',
    schedule: '*/15 * * * *', // Every 15 minutes
    function_name: 'chief-data-collector',
    description: 'Collect data from all active integrations'
  },
  {
    name: 'chief-daily-summary',
    schedule: '0 9 * * *', // Daily at 9 AM
    function_name: 'chief-daily-summarizer',
    description: 'Generate daily summaries for all users'
  },
  {
    name: 'chief-proactive-notifications',
    schedule: '*/30 * * * *', // Every 30 minutes
    function_name: 'chief-proactive-notifier',
    description: 'Send proactive notifications based on patterns'
  },
  {
    name: 'chief-cleanup-old-data',
    schedule: '0 2 * * *', // Daily at 2 AM
    function_name: 'chief-data-cleanup',
    description: 'Clean up old processed data and logs'
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Setting up Chief cron jobs...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = [];

    for (const job of CRON_JOBS) {
      try {
        console.log(`📅 Setting up cron job: ${job.name}`);
        
        // Create the cron job using pg_cron
        const { data, error } = await supabase.rpc('setup_cron_job', {
          job_name: job.name,
          job_schedule: job.schedule,
          job_command: `SELECT net.http_post(
            url:='${Deno.env.get('SUPABASE_URL')}/functions/v1/${job.function_name}',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}"}'::jsonb,
            body:='{"trigger": "cron", "timestamp": "' || now() || '"}'::jsonb
          ) as request_id;`
        });

        if (error) {
          console.error(`❌ Failed to set up ${job.name}:`, error);
          results.push({
            job: job.name,
            success: false,
            error: error.message
          });
        } else {
          console.log(`✅ Successfully set up ${job.name}`);
          results.push({
            job: job.name,
            success: true,
            schedule: job.schedule,
            description: job.description
          });
        }
      } catch (error) {
        console.error(`❌ Error setting up ${job.name}:`, error);
        results.push({
          job: job.name,
          success: false,
          error: error.message
        });
      }
    }

    // Log the setup completion
    await supabase
      .from('event_audit_log')
      .insert({
        user_id: null,
        stage: 'cron_setup',
        status: 'success',
        message: `Set up ${results.filter(r => r.success).length} cron jobs`
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Chief cron scheduler configured`,
        jobs: results,
        total_jobs: CRON_JOBS.length,
        successful_jobs: results.filter(r => r.success).length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    console.error('❌ Error in Chief Cron Scheduler:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});