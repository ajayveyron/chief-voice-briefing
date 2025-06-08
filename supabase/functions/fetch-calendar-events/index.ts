
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Fetching calendar events for user:', user.id)

    // Get the user's calendar integration
    const { data: integration, error: integrationError } = await supabaseClient
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_type', 'calendar')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      console.error('Calendar integration not found:', integrationError)
      return new Response(JSON.stringify({ error: 'Calendar integration not found or not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Found calendar integration:', integration.id)

    // Check if token is expired and needs refresh
    if (integration.token_expires_at && new Date(integration.token_expires_at) <= new Date()) {
      console.log('Access token expired, attempting refresh...')
      
      if (!integration.refresh_token) {
        return new Response(JSON.stringify({ error: 'Access token expired and no refresh token available' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Refresh the token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token'
        })
      })

      if (!tokenResponse.ok) {
        console.error('Token refresh failed:', await tokenResponse.text())
        return new Response(JSON.stringify({ error: 'Failed to refresh access token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tokens = await tokenResponse.json()
      
      // Update the integration with new token
      await supabaseClient
        .from('user_integrations')
        .update({
          access_token: tokens.access_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('id', integration.id)

      integration.access_token = tokens.access_token
    }

    console.log('Fetching calendar events from Google Calendar API...')

    // Fetch calendar events from Google Calendar API
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
      const errorText = await calendarResponse.text()
      console.error('Calendar API error:', calendarResponse.status, errorText)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch calendar events',
        details: errorText
      }), {
        status: calendarResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const calendarData = await calendarResponse.json()
    console.log('Calendar API response:', calendarData)

    // Format events for frontend
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

    console.log(`Successfully fetched ${events.length} calendar events`)

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in fetch-calendar-events:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
