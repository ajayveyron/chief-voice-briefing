// Slack data processing
import { logSyncStatus } from './sync-logger.ts';
import { storeRawEvent } from './raw-events-storage.ts';

// Function to fetch and process Slack messages
export async function processSlackData(supabase: any): Promise<number> {
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

        // Function to refresh token if needed
        async function refreshTokenIfExpired() {
          const now = new Date()
          const expiresAt = new Date(integration.token_expires_at)
          
          if (now >= expiresAt && integration.refresh_token) {
            console.log('Token expired, refreshing...')
            
            const refreshResponse = await fetch('https://slack.com/api/oauth.v2.access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: Deno.env.get('SLACK_CLIENT_ID') ?? '',
                client_secret: Deno.env.get('SLACK_CLIENT_SECRET') ?? '',
                refresh_token: integration.refresh_token,
                grant_type: 'refresh_token'
              })
            })

            if (refreshResponse.ok) {
              const tokens = await refreshResponse.json()
              if (tokens.ok) {
                integration.access_token = tokens.access_token
                integration.token_expires_at = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null
                
                // Update in database
                await supabase
                  .from('user_integrations')
                  .update({
                    access_token: tokens.access_token,
                    token_expires_at: integration.token_expires_at,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', integration.id)
                
                console.log('Token refreshed successfully')
              } else {
                throw new Error(`Failed to refresh token: ${tokens.error}`)
              }
            } else {
              throw new Error('Failed to refresh token')
            }
          }
        }

        await refreshTokenIfExpired()

        // Fetch messages directly from Slack API - simplified approach
        const messagesResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=false&limit=20', {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!messagesResponse.ok) {
          if (messagesResponse.status === 401) {
            await refreshTokenIfExpired()
            // Don't retry for Slack as token refresh is complex
          }
          throw new Error(`Slack API error: ${messagesResponse.status}`)
        }

        const channelsData = await messagesResponse.json()
        if (!channelsData.ok) {
          throw new Error(`Slack API error: ${channelsData.error}`)
        }

        const messages = []
        const channels = channelsData.channels || []

        // Get recent messages from accessible channels only
        for (const channel of channels.slice(0, 5)) {
          if (channel.is_member) {
            try {
              const historyResponse = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=10`, {
                headers: {
                  'Authorization': `Bearer ${integration.access_token}`,
                  'Content-Type': 'application/json'
                }
              })

              if (historyResponse.ok) {
                const historyData = await historyResponse.json()
                if (historyData.ok && historyData.messages) {
                  for (const message of historyData.messages) {
                    if (message.text && !message.bot_id) {
                      messages.push({
                        id: message.ts,
                        text: message.text,
                        user: message.user || 'Unknown',
                        channel: `#${channel.name}`,
                        timestamp: new Date(parseFloat(message.ts) * 1000).toISOString()
                      })
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching messages from channel ${channel.name}:`, error)
            }
          }
        }

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