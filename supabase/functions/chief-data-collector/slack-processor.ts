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