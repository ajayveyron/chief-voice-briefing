
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarEventRequest {
  action: 'create' | 'update' | 'delete';
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
    console.log(`📅 Managing calendar event for user: ${user.id}, action: ${eventRequest.action}`);

    // Get user's Calendar integration
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('integration_type', 'calendar')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      throw new Error('Calendar integration not found or inactive');
    }

    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    let method = 'POST';
    let body: any = {};

    switch (eventRequest.action) {
      case 'create':
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
        throw new Error('Invalid action. Must be create, update, or delete');
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: eventRequest.action !== 'delete' ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Calendar API error: ${error}`);
    }

    const result = eventRequest.action !== 'delete' ? await response.json() : { deleted: true };
    console.log(`✅ Calendar event ${eventRequest.action} successful:`, result.id || 'deleted');

    return new Response(
      JSON.stringify({
        success: true,
        action: eventRequest.action,
        event: result,
        message: `Event ${eventRequest.action} successful`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error managing calendar event:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
