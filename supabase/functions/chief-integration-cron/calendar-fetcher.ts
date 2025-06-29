
import { UserIntegration, CalendarEvent } from './types.ts';

export async function fetchCalendarData(integration: UserIntegration, validToken: string): Promise<CalendarEvent[]> {
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
    
    const events: CalendarEvent[] = calendarData.items?.map((event: any) => ({
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
