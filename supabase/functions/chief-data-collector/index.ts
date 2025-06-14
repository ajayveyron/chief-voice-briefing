import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to create content hash for deduplication
function createContentHash(content: any, sourceId: string): string {
  const contentString = JSON.stringify(content) + sourceId;
  return btoa(contentString).slice(0, 64); // Simple hash for demo
}

// Function to log sync status
async function logSyncStatus(
  supabase: any, 
  integrationId: string, 
  syncType: 'polling' | 'webhook', 
  status: 'success' | 'error' | 'partial',
  errorMessage?: string,
  metadata?: any
) {
  const { error } = await supabase
    .from('integration_sync_log')
    .insert({
      integration_id: integrationId,
      sync_type: syncType,
      status,
      last_synced_at: new Date().toISOString(),
      error_message: errorMessage,
      metadata: metadata || {}
    });

  if (error) {
    console.error('Error logging sync status:', error);
  }
}

// Function to store raw events with deduplication
async function storeRawEvent(
  supabase: any,
  integrationId: string,
  userId: string,
  source: string,
  eventType: string,
  content: any,
  sourceId: string
) {
  const contentHash = createContentHash(content, sourceId);
  
  // Check if we already have this content
  const { data: existing } = await supabase
    .from('raw_events')
    .select('id')
    .eq('content_hash', contentHash)
    .single();

  if (existing) {
    console.log(`Skipping duplicate content: ${contentHash}`);
    return null;
  }

  // Store new raw event
  const { data, error } = await supabase
    .from('raw_events')
    .insert({
      integration_id: integrationId,
      user_id: userId,
      source,
      event_type: eventType,
      content: JSON.stringify(content),
      content_hash: contentHash,
      timestamp: new Date().toISOString(),
      status: 'raw'
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing raw event:', error);
    return null;
  }

  return data;
}

// Function to fetch and process Gmail emails
async function processGmailData(supabase: any): Promise<number> {
  console.log('🔄 Processing Gmail data...');
  let totalProcessed = 0;

  try {
    // Get all active Gmail integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('integration_type', 'gmail')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching Gmail integrations:', intError);
      return 0;
    }

    console.log(`📧 Found ${integrations?.length || 0} Gmail integrations`);

    for (const integration of integrations || []) {
      try {
        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, { 
          started_at: new Date().toISOString() 
        });

        // Call the existing fetch-gmail-emails function
        const { data: emailData, error: emailError } = await supabase.functions.invoke('fetch-gmail-emails', {
          headers: {
            Authorization: `Bearer ${integration.access_token}`
          }
        });

        if (emailError) {
          console.error(`Error fetching emails for user ${integration.user_id}:`, emailError);
          await logSyncStatus(supabase, integration.id, 'polling', 'error', emailError.message);
          continue;
        }

        const emails = emailData?.emails || [];
        console.log(`📧 Processing ${emails.length} emails for user ${integration.user_id}`);

        for (const email of emails) {
          const rawEvent = await storeRawEvent(
            supabase,
            integration.id,
            integration.user_id,
            'gmail',
            'email',
            email,
            email.id
          );
          
          if (rawEvent) {
            totalProcessed++;
          }
        }

        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, {
          emails_processed: emails.length,
          completed_at: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Error processing Gmail for user ${integration.user_id}:`, error);
        await logSyncStatus(supabase, integration.id, 'polling', 'error', error.message);
      }
    }
  } catch (error) {
    console.error('Error in Gmail processing:', error);
  }

  return totalProcessed;
}

// Function to fetch and process Calendar events
async function processCalendarData(supabase: any): Promise<number> {
  console.log('🔄 Processing Calendar data...');
  let totalProcessed = 0;

  try {
    // Get all active Calendar integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('integration_type', 'calendar')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching Calendar integrations:', intError);
      return 0;
    }

    console.log(`📅 Found ${integrations?.length || 0} Calendar integrations`);

    for (const integration of integrations || []) {
      try {
        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, { 
          started_at: new Date().toISOString() 
        });

        // Call the existing fetch-calendar-events function
        const { data: calendarData, error: calendarError } = await supabase.functions.invoke('fetch-calendar-events', {
          headers: {
            Authorization: `Bearer ${integration.access_token}`
          }
        });

        if (calendarError) {
          console.error(`Error fetching calendar for user ${integration.user_id}:`, calendarError);
          await logSyncStatus(supabase, integration.id, 'polling', 'error', calendarError.message);
          continue;
        }

        const events = calendarData?.events || [];
        console.log(`📅 Processing ${events.length} events for user ${integration.user_id}`);

        for (const event of events) {
          const rawEvent = await storeRawEvent(
            supabase,
            integration.id,
            integration.user_id,
            'calendar',
            'event',
            event,
            event.id
          );
          
          if (rawEvent) {
            totalProcessed++;
          }
        }

        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, {
          events_processed: events.length,
          completed_at: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Error processing Calendar for user ${integration.user_id}:`, error);
        await logSyncStatus(supabase, integration.id, 'polling', 'error', error.message);
      }
    }
  } catch (error) {
    console.error('Error in Calendar processing:', error);
  }

  return totalProcessed;
}

// Function to fetch and process Slack messages
async function processSlackData(supabase: any): Promise<number> {
  console.log('🔄 Processing Slack data...');
  let totalProcessed = 0;

  try {
    // Get all active Slack integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('integration_type', 'slack')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching Slack integrations:', intError);
      return 0;
    }

    console.log(`💬 Found ${integrations?.length || 0} Slack integrations`);

    for (const integration of integrations || []) {
      try {
        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, { 
          started_at: new Date().toISOString() 
        });

        // Call the existing fetch-slack-messages function
        const { data: slackData, error: slackError } = await supabase.functions.invoke('fetch-slack-messages', {
          headers: {
            Authorization: `Bearer ${integration.access_token}`
          }
        });

        if (slackError) {
          console.error(`Error fetching Slack for user ${integration.user_id}:`, slackError);
          await logSyncStatus(supabase, integration.id, 'polling', 'error', slackError.message);
          continue;
        }

        const messages = slackData?.messages || [];
        console.log(`💬 Processing ${messages.length} messages for user ${integration.user_id}`);

        for (const message of messages) {
          const rawEvent = await storeRawEvent(
            supabase,
            integration.id,
            integration.user_id,
            'slack',
            'message',
            message,
            message.ts || message.id
          );
          
          if (rawEvent) {
            totalProcessed++;
          }
        }

        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, {
          messages_processed: messages.length,
          completed_at: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Error processing Slack for user ${integration.user_id}:`, error);
        await logSyncStatus(supabase, integration.id, 'polling', 'error', error.message);
      }
    }
  } catch (error) {
    console.error('Error in Slack processing:', error);
  }

  return totalProcessed;
}

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