
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarEventRequest {
  action: 'create' | 'update' | 'delete' | 'read';
  eventId?: string; // Required for update/delete
  summary: string;
  description?: string;
  start: {
    dateTime: string; // ISO string
    timeZone?: string;
  };
  end: {
    dateTime: string; // ISO string
    timeZone?: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
  maxResults?: number; // For read operations
  timeMin?: string; // For read operations
  timeMax?: string; // For read operations
}

// Function to refresh access token if needed
async function refreshTokenIfNeeded(supabase: any, integration: any): Promise<string> {
  if (integration.token_expires_at && new Date(integration.token_expires_at) <= new Date()) {
    console.log('🔄 Access token expired, refreshing...');
    
    if (!integration.refresh_token) {
      throw new Error('Access token expired and no refresh token available');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: integration.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', errorText);
      throw new Error('Failed to refresh access token');
    }

    const tokens = await tokenResponse.json();
    
    // Update the integration with new token
    await supabase
      .from('user_integrations')
      .update({
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq('id', integration.id);

    console.log('✅ Token refreshed successfully');
    return tokens.access_token;
  }

  return integration.access_token;
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

    const eventRequest: CalendarEventRequest = await req.json();
    console.log(`📅 Managing calendar for user: ${user.id}, action: ${eventRequest.action}`);

    // Get user's Calendar integration
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_type', 'calendar')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      throw new Error('Calendar integration not found or inactive. Please connect your Google Calendar first.');
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, integration);

    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    let method = 'GET';
    let body: any = null;

    switch (eventRequest.action) {
      case 'read':
        // Handle reading calendar events
        const now = new Date();
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const params = new URLSearchParams({
          timeMin: eventRequest.timeMin || now.toISOString(),
          timeMax: eventRequest.timeMax || oneWeekFromNow.toISOString(),
          maxResults: (eventRequest.maxResults || 10).toString(),
          singleEvents: 'true',
          orderBy: 'startTime'
        });
        
        url += `?${params.toString()}`;
        method = 'GET';
        break;

      case 'create':
        method = 'POST';
        body = {
          summary: eventRequest.summary,
          description: eventRequest.description,
          start: eventRequest.start,
          end: eventRequest.end,
          attendees: eventRequest.attendees,
          location: eventRequest.location,
          reminders: eventRequest.reminders || { useDefault: true }
        };
        break;

      case 'update':
        if (!eventRequest.eventId) {
          throw new Error('Event ID required for update');
        }
        url += `/${eventRequest.eventId}`;
        method = 'PUT';
        body = {
          summary: eventRequest.summary,
          description: eventRequest.description,
          start: eventRequest.start,
          end: eventRequest.end,
          attendees: eventRequest.attendees,
          location: eventRequest.location,
          reminders: eventRequest.reminders
        };
        break;

      case 'delete':
        if (!eventRequest.eventId) {
          throw new Error('Event ID required for delete');
        }
        url += `/${eventRequest.eventId}`;
        method = 'DELETE';
        break;

      default:
        throw new Error('Invalid action. Must be create, update, delete, or read');
    }

    console.log(`📅 Making ${method} request to: ${url}`);

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Calendar API error (${response.status}):`, errorText);
      throw new Error(`Calendar API error: ${errorText}`);
    }

    let result;
    if (eventRequest.action === 'delete') {
      result = { deleted: true, eventId: eventRequest.eventId };
    } else if (eventRequest.action === 'read') {
      const data = await response.json();
      result = {
        events: data.items?.map((event: any) => ({
          id: event.id,
          summary: event.summary || 'No title',
          description: event.description || '',
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          location: event.location || '',
          attendees: event.attendees?.map((a: any) => ({ email: a.email, displayName: a.displayName })) || [],
          htmlLink: event.htmlLink
        })) || []
      };
    } else {
      result = await response.json();
    }

    console.log(`✅ Calendar ${eventRequest.action} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        action: eventRequest.action,
        data: result,
        message: `Calendar ${eventRequest.action} successful`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error managing calendar:', error);
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
