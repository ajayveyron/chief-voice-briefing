
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

    console.log('⏰ Task Scheduler running...');

    const now = new Date().toISOString();

    // Get all pending scheduled tasks that are due
    const { data: dueTasks, error: tasksError } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('is_completed', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (tasksError) {
      throw tasksError;
    }

    console.log(`📋 Found ${dueTasks?.length || 0} due tasks`);

    for (const task of dueTasks || []) {
      try {
        console.log(`🔄 Processing task: ${task.task_type} - ${task.title}`);

        let success = false;

        switch (task.task_type) {
          case 'email':
            // Send scheduled email
            const emailResult = await supabase.functions.invoke('send-email', {
              body: task.metadata,
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              }
            });
            success = !emailResult.error;
            break;

          case 'slack_message':
            // Send scheduled Slack message
            const slackResult = await supabase.functions.invoke('send-slack-message', {
              body: task.metadata,
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              }
            });
            success = !slackResult.error;
            break;

          case 'reminder':
          case 'notification':
            // Create a processed update for the user to see
            const { error: updateError } = await supabase
              .from('processed_updates')
              .insert({
                user_id: task.user_id,
                source: 'chief_reminder',
                source_id: task.id,
                content: {
                  type: task.task_type,
                  title: task.title,
                  description: task.description,
                  metadata: task.metadata
                },
                summary: `⏰ Reminder: ${task.title}`,
                action_suggestions: ['Mark as complete', 'Dismiss reminder'],
                priority: task.metadata?.priority || 2
              });
            success = !updateError;
            break;

          default:
            console.log(`❓ Unknown task type: ${task.task_type}`);
            success = true; // Mark as completed to avoid reprocessing
        }

        if (success) {
          // Mark task as completed
          await supabase
            .from('scheduled_tasks')
            .update({ 
              is_completed: true, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', task.id);

          console.log(`✅ Task completed: ${task.title}`);
        } else {
          console.log(`❌ Task failed: ${task.title}`);
        }

      } catch (error) {
        console.error(`❌ Error processing task ${task.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: dueTasks?.length || 0,
        message: 'Task scheduler completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in task scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
