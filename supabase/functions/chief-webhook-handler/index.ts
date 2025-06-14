import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  source: 'gmail' | 'slack' | 'calendar' | 'generic';
  event_type: string;
  user_id?: string;
  data: any;
  timestamp?: string;
  signature?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const source = url.searchParams.get('source') || 'generic';
    const userId = url.searchParams.get('user_id');

    console.log(`📥 Received webhook from ${source} for user ${userId}`);

    const payload = await req.json() as WebhookPayload;
    payload.source = source as any;
    payload.timestamp = payload.timestamp || new Date().toISOString();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify webhook signature if provided
    const isVerified = await verifyWebhookSignature(req, payload, source);
    if (!isVerified) {
      console.warn('⚠️ Webhook signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process webhook based on source
    let processResult;
    switch (source) {
      case 'gmail':
        processResult = await processGmailWebhook(supabase, payload);
        break;
      case 'slack':
        processResult = await processSlackWebhook(supabase, payload);
        break;
      case 'calendar':
        processResult = await processCalendarWebhook(supabase, payload);
        break;
      default:
        processResult = await processGenericWebhook(supabase, payload);
        break;
    }

    // Log webhook receipt
    await supabase
      .from('event_audit_log')
      .insert({
        user_id: userId,
        stage: 'webhook_received',
        status: processResult.success ? 'success' : 'error',
        message: `Webhook from ${source}: ${processResult.message}`
      });

    // Trigger real-time processing if needed
    if (processResult.success && processResult.requiresProcessing) {
      await triggerRealtimeProcessing(supabase, processResult.eventId, userId);
    }

    return new Response(
      JSON.stringify({
        success: processResult.success,
        message: processResult.message,
        event_id: processResult.eventId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    console.error('❌ Error in Chief Webhook Handler:', error);
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

async function verifyWebhookSignature(req: Request, payload: WebhookPayload, source: string): Promise<boolean> {
  try {
    // For now, return true. In production, implement proper signature verification
    // based on the source's webhook security model
    
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-slack-signature');
    
    if (!signature) {
      console.log('📝 No signature provided, allowing webhook');
      return true; // Allow webhooks without signature for development
    }

    // TODO: Implement actual signature verification for each source
    // Gmail: Use X-Goog-Channel-Token header
    // Slack: Use X-Slack-Signature header with signing secret
    // Calendar: Use X-Goog-Resource-State header
    
    return true;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}

async function processGmailWebhook(supabase: any, payload: WebhookPayload): Promise<{success: boolean, message: string, eventId?: string, requiresProcessing: boolean}> {
  try {
    console.log('📧 Processing Gmail webhook');
    
    // Gmail sends minimal data in webhooks, we need to fetch the actual email
    const { user_id } = payload;
    if (!user_id) {
      return { success: false, message: 'No user_id provided', requiresProcessing: false };
    }

    // Store the webhook trigger event
    const { data: eventData, error: eventError } = await supabase
      .from('raw_events')
      .insert({
        user_id: user_id,
        source: 'gmail',
        event_type: 'webhook_trigger',
        content: JSON.stringify(payload.data),
        timestamp: payload.timestamp,
        status: 'raw'
      })
      .select()
      .single();

    if (eventError) {
      throw new Error(`Failed to store Gmail webhook event: ${eventError.message}`);
    }

    // Trigger data collection to fetch the actual new emails
    await supabase.functions.invoke('chief-data-collector', {
      body: {
        user_id: user_id,
        source: 'gmail',
        trigger: 'webhook'
      }
    });

    return {
      success: true,
      message: 'Gmail webhook processed, triggered data collection',
      eventId: eventData.id,
      requiresProcessing: true
    };
  } catch (error) {
    console.error('❌ Error processing Gmail webhook:', error);
    return { success: false, message: error.message, requiresProcessing: false };
  }
}

async function processSlackWebhook(supabase: any, payload: WebhookPayload): Promise<{success: boolean, message: string, eventId?: string, requiresProcessing: boolean}> {
  try {
    console.log('💬 Processing Slack webhook');
    
    // Handle Slack event types
    const eventType = payload.data?.type || payload.event_type;
    
    if (eventType === 'url_verification') {
      // Slack URL verification challenge
      return {
        success: true,
        message: 'Slack URL verification',
        requiresProcessing: false
      };
    }

    const userId = payload.data?.event?.user || payload.user_id;
    if (!userId) {
      return { success: false, message: 'No user_id found in Slack webhook', requiresProcessing: false };
    }

    // Store the Slack event
    const { data: eventData, error: eventError } = await supabase
      .from('raw_events')
      .insert({
        user_id: userId,
        source: 'slack',
        event_type: eventType,
        content: JSON.stringify(payload.data),
        timestamp: payload.timestamp,
        status: 'raw'
      })
      .select()
      .single();

    if (eventError) {
      throw new Error(`Failed to store Slack webhook event: ${eventError.message}`);
    }

    return {
      success: true,
      message: `Slack ${eventType} event processed`,
      eventId: eventData.id,
      requiresProcessing: true
    };
  } catch (error) {
    console.error('❌ Error processing Slack webhook:', error);
    return { success: false, message: error.message, requiresProcessing: false };
  }
}

async function processCalendarWebhook(supabase: any, payload: WebhookPayload): Promise<{success: boolean, message: string, eventId?: string, requiresProcessing: boolean}> {
  try {
    console.log('📅 Processing Calendar webhook');
    
    const { user_id } = payload;
    if (!user_id) {
      return { success: false, message: 'No user_id provided', requiresProcessing: false };
    }

    // Store the calendar webhook event
    const { data: eventData, error: eventError } = await supabase
      .from('raw_events')
      .insert({
        user_id: user_id,
        source: 'calendar',
        event_type: 'webhook_trigger',
        content: JSON.stringify(payload.data),
        timestamp: payload.timestamp,
        status: 'raw'
      })
      .select()
      .single();

    if (eventError) {
      throw new Error(`Failed to store Calendar webhook event: ${eventError.message}`);
    }

    // Trigger calendar data collection
    await supabase.functions.invoke('chief-data-collector', {
      body: {
        user_id: user_id,
        source: 'calendar',
        trigger: 'webhook'
      }
    });

    return {
      success: true,
      message: 'Calendar webhook processed, triggered data collection',
      eventId: eventData.id,
      requiresProcessing: true
    };
  } catch (error) {
    console.error('❌ Error processing Calendar webhook:', error);
    return { success: false, message: error.message, requiresProcessing: false };
  }
}

async function processGenericWebhook(supabase: any, payload: WebhookPayload): Promise<{success: boolean, message: string, eventId?: string, requiresProcessing: boolean}> {
  try {
    console.log('🔄 Processing generic webhook');
    
    // Store the generic webhook event
    const { data: eventData, error: eventError } = await supabase
      .from('raw_events')
      .insert({
        user_id: payload.user_id || null,
        source: 'webhook',
        event_type: payload.event_type || 'generic',
        content: JSON.stringify(payload.data),
        timestamp: payload.timestamp,
        status: 'raw'
      })
      .select()
      .single();

    if (eventError) {
      throw new Error(`Failed to store generic webhook event: ${eventError.message}`);
    }

    return {
      success: true,
      message: 'Generic webhook processed',
      eventId: eventData.id,
      requiresProcessing: true
    };
  } catch (error) {
    console.error('❌ Error processing generic webhook:', error);
    return { success: false, message: error.message, requiresProcessing: false };
  }
}

async function triggerRealtimeProcessing(supabase: any, eventId: string, userId: string | null): Promise<void> {
  try {
    // Trigger summarization for the new event
    await supabase.functions.invoke('chief-summarizer', {
      body: {
        event_id: eventId,
        user_id: userId,
        trigger: 'webhook'
      }
    });

    // Send real-time notification to connected clients
    if (userId) {
      const channel = supabase.channel(`user:${userId}`);
      await channel.send({
        type: 'broadcast',
        event: 'new_data',
        payload: {
          event_id: eventId,
          timestamp: new Date().toISOString(),
          source: 'webhook'
        }
      });
    }
  } catch (error) {
    console.error('❌ Error triggering realtime processing:', error);
  }
}