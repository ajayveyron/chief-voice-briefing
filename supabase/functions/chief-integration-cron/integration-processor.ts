
import { UserIntegration } from './types.ts';
import { ensureValidToken } from './token-manager.ts';
import { fetchGmailData } from './gmail-fetcher.ts';
import { fetchCalendarData } from './calendar-fetcher.ts';
import { fetchSlackData } from './slack-fetcher.ts';

export async function processIntegration(integration: UserIntegration, supabase: any) {
  try {
    console.log(`🔄 Processing ${integration.integration_type} for user ${integration.user_id}`);

    const validToken = await ensureValidToken(integration, supabase);
    if (!validToken) {
      console.error(`❌ Failed to get valid token for user ${integration.user_id}, integration ${integration.integration_type}`);
      return;
    }

    let data: any[] = [];

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

    console.log(`THIS_IS_INTEGRATIONS_DATA ${integration.integration_type} ${integration.user_id}:`, JSON.stringify(data));

    for (const item of data) {
      const contentHash = btoa(JSON.stringify(item) + integration.integration_type + integration.user_id);
      
      const { data: existing } = await supabase
        .from('raw_events')
        .select('id')
        .eq('content_hash', contentHash)
        .single();

      if (!existing) {
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
