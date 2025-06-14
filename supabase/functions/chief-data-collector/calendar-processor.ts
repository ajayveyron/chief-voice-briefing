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

        // Function to refresh token if needed
        async function refreshTokenIfExpired() {
          const now = new Date()
          const expiresAt = new Date(integration.token_expires_at)
          
          if (now >= expiresAt && integration.refresh_token) {
            console.log('Token expired, refreshing...')
            
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
                client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
                refresh_token: integration.refresh_token,
                grant_type: 'refresh_token'
              })
            })

            if (refreshResponse.ok) {
              const tokens = await refreshResponse.json()
              integration.access_token = tokens.access_token
              integration.token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
              
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
              throw new Error('Failed to refresh token')
            }
          }
        }

        await refreshTokenIfExpired()

        // Fetch calendar events directly from Google Calendar API
        const now = new Date()
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

        const calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          `timeMin=${now.toISOString()}&` +
          `timeMax=${oneWeekFromNow.toISOString()}&` +
          `maxResults=10&` +
          `singleEvents=true&` +
          `orderBy=startTime`,
          {
            headers: {
              'Authorization': `Bearer ${integration.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!calendarResponse.ok) {
          if (calendarResponse.status === 401) {
            await refreshTokenIfExpired()
            // Retry after refresh
            const retryResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
              `timeMin=${now.toISOString()}&` +
              `timeMax=${oneWeekFromNow.toISOString()}&` +
              `maxResults=10&` +
              `singleEvents=true&` +
              `orderBy=startTime`,
              {
                headers: {
                  'Authorization': `Bearer ${integration.access_token}`,
                  'Content-Type': 'application/json'
                }
              }
            )
            
            if (!retryResponse.ok) {
              throw new Error(`Calendar API error after refresh: ${retryResponse.status}`)
            }
            
            const calendarData = await retryResponse.json()
            
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
            })) || []

            console.log(`📅 Processing ${events.length} events for user ${integration.user_id}`)

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
            
            continue;
          }
          throw new Error(`Calendar API error: ${calendarResponse.status}`)
        }

        const calendarData = await calendarResponse.json()
        
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
        })) || []

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