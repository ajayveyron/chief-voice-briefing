
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserIntegration {
  id: string;
  user_id: string;
  integration_type: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  is_active: boolean;
}

async function refreshGoogleToken(integration: UserIntegration, supabase: any): Promise<string | null> {
  if (!integration.refresh_token) {
    console.error(`No refresh token available for user ${integration.user_id}, integration ${integration.integration_type}`);
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: integration.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      console.error(`Token refresh failed for user ${integration.user_id}:`, await response.text());
      return null;
    }

    const tokens = await response.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update the integration with new token
    const { error } = await supabase
      .from('user_integrations')
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (error) {
      console.error(`Failed to update token for user ${integration.user_id}:`, error);
      return null;
    }

    console.log(`✅ Token refreshed successfully for user ${integration.user_id}, integration ${integration.integration_type}`);
    return tokens.access_token;

  } catch (error) {
    console.error(`Error refreshing token for user ${integration.user_id}:`, error);
    return null;
  }
}

async function refreshSlackToken(integration: UserIntegration, supabase: any): Promise<string | null> {
  if (!integration.refresh_token) {
    console.error(`No refresh token available for user ${integration.user_id}, integration ${integration.integration_type}`);
    return null;
  }

  try {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('SLACK_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('SLACK_CLIENT_SECRET') ?? '',
        refresh_token: integration.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      console.error(`Slack token refresh failed for user ${integration.user_id}:`, await response.text());
      return null;
    }

    const tokens = await response.json();
    
    if (!tokens.ok) {
      console.error(`Slack token refresh error for user ${integration.user_id}:`, tokens.error);
      return null;
    }

    const newExpiresAt = tokens.expires_in ? 
      new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    // Update the integration with new token
    const { error } = await supabase
      .from('user_integrations')
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (error) {
      console.error(`Failed to update Slack token for user ${integration.user_id}:`, error);
      return null;
    }

    console.log(`✅ Slack token refreshed successfully for user ${integration.user_id}`);
    return tokens.access_token;

  } catch (error) {
    console.error(`Error refreshing Slack token for user ${integration.user_id}:`, error);
    return null;
  }
}

async function ensureValidToken(integration: UserIntegration, supabase: any): Promise<string | null> {
  // Check if token is expired or about to expire (within 5 minutes)
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log(`🔄 Token expired/expiring for user ${integration.user_id}, integration ${integration.integration_type}. Refreshing...`);
    
    switch (integration.integration_type) {
      case 'gmail':
      case 'calendar':
        return await refreshGoogleToken(integration, supabase);
      case 'slack':
        return await refreshSlackToken(integration, supabase);
      default:
        console.log(`No token refresh logic for integration type: ${integration.integration_type}`);
        return integration.access_token;
    }
  }

  return integration.access_token;
}

async function fetchGmailData(integration: UserIntegration, validToken: string) {
  try {
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=-category:{promotions updates forums social}&labelIds=INBOX', {
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!gmailResponse.ok) {
      throw new Error(`Gmail API error: ${gmailResponse.status}`);
    }

    const messagesData = await gmailResponse.json();
    const emails = [];

    // Fetch details for each message
    for (const message of messagesData.messages || []) {
      const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (detailResponse.ok) {
        const emailDetail = await detailResponse.json();
        
        // Extract subject and sender
        const headers = emailDetail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';
        
        // Extract body text
        let body = '';
        if (emailDetail.payload?.body?.data) {
          body = atob(emailDetail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (emailDetail.payload?.parts) {
          const textPart = emailDetail.payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        }

        emails.push({
          id: message.id,
          subject,
          from,
          date,
          snippet: emailDetail.snippet || '',
          body: body.substring(0, 500) // Limit body length
        });
      }
    }

    return emails;
  } catch (error) {
    console.error(`Error fetching Gmail data:`, error);
    return [];
  }
}

async function fetchCalendarData(integration: UserIntegration, validToken: string) {
  try {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now.toISOString()}&` +
      `timeMax=${oneWeekFromNow.toISOString()}&` +
      `maxResults=10&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!calendarResponse.ok) {
      throw new Error(`Calendar API error: ${calendarResponse.status}`);
    }

    const calendarData = await calendarResponse.json();
    
    // Format events
    const events = calendarData.items?.map((event: any) => ({
      id: event.id,
      summary: event.summary || 'No title',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      description: event.description || '',
      location: event.location || '',
      attendees: event.attendees?.map((attendee: any) => attendee.email) || [],
      htmlLink: event.htmlLink
    })) || [];

    return events;
  } catch (error) {
    console.error(`Error fetching Calendar data:`, error);
    return [];
  }
}

async function fetchSlackData(integration: UserIntegration, validToken: string) {
  try {
    // Fetch messages directly from Slack API - simplified approach
    const messagesResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=false&limit=20', {
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error(`Slack API error: ${messagesResponse.status}`);
    }

    const channelsData = await messagesResponse.json();
    if (!channelsData.ok) {
      throw new Error(`Slack API error: ${channelsData.error}`);
    }

    const messages = [];
    const channels = channelsData.channels || [];

    // Get recent messages from accessible channels only
    for (const channel of channels.slice(0, 5)) {
      if (channel.is_member) {
        try {
          const historyResponse = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=10`, {
            headers: {
              'Authorization': `Bearer ${validToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            if (historyData.ok && historyData.messages) {
              for (const message of historyData.messages) {
                if (message.text && !message.bot_id) {
                  messages.push({
                    id: message.ts,
                    text: message.text,
                    user: message.user || 'Unknown',
                    channel: `#${channel.name}`,
                    timestamp: new Date(parseFloat(message.ts) * 1000).toISOString()
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching messages from channel ${channel.name}:`, error);
        }
      }
    }

    return messages;
  } catch (error) {
    console.error(`Error fetching Slack data:`, error);
    return [];
  }
}

async function processIntegration(integration: UserIntegration, supabase: any) {
  try {
    console.log(`🔄 Processing ${integration.integration_type} for user ${integration.user_id}`);

    // Ensure we have a valid token
    const validToken = await ensureValidToken(integration, supabase);
    if (!validToken) {
      console.error(`❌ Failed to get valid token for user ${integration.user_id}, integration ${integration.integration_type}`);
      return;
    }

    let data = [];

    // Fetch data based on integration type
    switch (integration.integration_type) {
      case 'gmail':
        data = await fetchGmailData(integration, validToken);
        break;
      case 'calendar':
        data = await fetchCalendarData(integration, validToken);
        break;
      case 'slack':
        data = await fetchSlackData(integration, validToken);
        break;
      default:
        console.log(`⚠️ No data fetching logic for integration type: ${integration.integration_type}`);
        return;
    }

    // Log the output as requested
    console.log(`THIS_IS_INTEGRATIONS_DATA ${integration.integration_type} ${integration.user_id}:`, JSON.stringify(data));

    // Store raw events in the database
    for (const item of data) {
      const contentHash = btoa(JSON.stringify(item) + integration.integration_type + integration.user_id);
      
      // Check if we already have this content
      const { data: existing } = await supabase
        .from('raw_events')
        .select('id')
        .eq('content_hash', contentHash)
        .single();

      if (!existing) {
        // Store new raw event
        await supabase
          .from('raw_events')
          .insert({
            integration_id: integration.id,
            user_id: integration.user_id,
            source: integration.integration_type,
            event_type: integration.integration_type === 'gmail' ? 'email' : integration.integration_type === 'calendar' ? 'event' : 'message',
            content: JSON.stringify(item),
            content_hash: contentHash,
            timestamp: new Date().toISOString(),
            status: 'raw'
          });
      }
    }

    console.log(`✅ Successfully processed ${data.length} items for ${integration.integration_type} user ${integration.user_id}`);

  } catch (error) {
    console.error(`❌ Error processing ${integration.integration_type} for user ${integration.user_id}:`, error);
  }
}

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

    // Get all active user integrations
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

    // Process each integration
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
