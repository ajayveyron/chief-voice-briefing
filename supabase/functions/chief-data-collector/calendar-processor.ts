// Calendar data processing
import { logSyncStatus } from './sync-logger.ts';
import { storeRawEvent } from './raw-events-storage.ts';

// Function to fetch and process Calendar events
export async function processCalendarData(supabase: any): Promise<number> {
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