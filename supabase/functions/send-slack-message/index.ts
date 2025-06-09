
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackMessageRequest {
  channel?: string; // Channel ID or name (e.g., "#general" or "C1234567890")
  user?: string; // User ID for DM (e.g., "U1234567890")
  text: string;
  scheduledFor?: string; // ISO string for scheduled sending
  threadTs?: string; // For replying to a thread
  blocks?: any[]; // Rich formatting blocks
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const messageRequest: SlackMessageRequest = await req.json();
    console.log(`💬 Sending Slack message for user: ${user.id}`);

    // Get user's Slack integration
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('integration_type', 'slack')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      throw new Error('Slack integration not found or inactive');
    }

    // If scheduled, store for later processing
    if (messageRequest.scheduledFor) {
      const { error: scheduleError } = await supabase
        .from('scheduled_tasks')
        .insert({
          user_id: user.id,
          task_type: 'slack_message',
          title: `Send Slack message`,
          description: `To: ${messageRequest.channel || messageRequest.user} - ${messageRequest.text.substring(0, 100)}...`,
          scheduled_for: messageRequest.scheduledFor,
          metadata: messageRequest
        });

      if (scheduleError) {
        throw scheduleError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Slack message scheduled successfully',
          scheduledFor: messageRequest.scheduledFor
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the target (channel or user)
    let channel = messageRequest.channel;
    if (messageRequest.user && !messageRequest.channel) {
      // Open a DM channel with the user
      const dmResponse = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: messageRequest.user }),
      });

      if (!dmResponse.ok) {
        throw new Error('Failed to open DM channel');
      }

      const dmResult = await dmResponse.json();
      if (!dmResult.ok) {
        throw new Error(`Slack API error: ${dmResult.error}`);
      }

      channel = dmResult.channel.id;
    }

    if (!channel) {
      throw new Error('Either channel or user must be specified');
    }

    // Send the message
    const messageBody: any = {
      channel,
      text: messageRequest.text,
    };

    if (messageRequest.threadTs) {
      messageBody.thread_ts = messageRequest.threadTs;
    }

    if (messageRequest.blocks) {
      messageBody.blocks = messageRequest.blocks;
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageBody),
    });

    if (!response.ok) {
      throw new Error('Failed to send Slack message');
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }

    console.log('✅ Slack message sent successfully:', result.ts);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: result.ts,
        channel: result.channel,
        message: 'Slack message sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error sending Slack message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
