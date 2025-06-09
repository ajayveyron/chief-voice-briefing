
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

    const { attendeeEmails, duration = 60, preferredTimes, subject, description } = await req.json()

    console.log('Coordinating meeting for:', { attendeeEmails, duration, subject })

    // Get the user's calendar integration
    const { data: integration, error: integrationError } = await supabaseClient
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_type', 'calendar')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: 'Calendar integration not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check and refresh token if needed
    if (integration.token_expires_at && new Date(integration.token_expires_at) <= new Date()) {
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
        return new Response(JSON.stringify({ error: 'Failed to refresh access token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tokens = await tokenResponse.json()
      await supabaseClient
        .from('user_integrations')
        .update({
          access_token: tokens.access_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('id', integration.id)

      integration.access_token = tokens.access_token
    }

    // Find free/busy information for all attendees
    const now = new Date()
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const freeBusyResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/freeBusy',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeMin: now.toISOString(),
          timeMax: oneWeekFromNow.toISOString(),
          items: attendeeEmails.map((email: string) => ({ id: email }))
        })
      }
    )

    if (!freeBusyResponse.ok) {
      const errorText = await freeBusyResponse.text()
      console.error('FreeBusy API error:', errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch calendar availability' }), {
        status: freeBusyResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const freeBusyData = await freeBusyResponse.json()
    
    // Find suitable time slots
    const suitableSlots = findAvailableSlots(freeBusyData, duration, now, oneWeekFromNow)
    
    if (suitableSlots.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No suitable time slots found for all attendees in the next week.',
        busyTimes: freeBusyData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use the first available slot
    const selectedSlot = suitableSlots[0]

    // Create the meeting
    const event = {
      summary: subject || 'Team Meeting',
      description: description || 'Meeting coordinated by Chief AI Assistant',
      start: {
        dateTime: selectedSlot.start.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: selectedSlot.end.toISOString(),
        timeZone: 'UTC'
      },
      attendees: attendeeEmails.map((email: string) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    }

    const createEventResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    )

    if (!createEventResponse.ok) {
      const errorText = await createEventResponse.text()
      console.error('Create event error:', errorText)
      return new Response(JSON.stringify({ error: 'Failed to create meeting' }), {
        status: createEventResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const createdEvent = await createEventResponse.json()
    
    return new Response(JSON.stringify({ 
      success: true,
      event: createdEvent,
      selectedSlot,
      alternativeSlots: suitableSlots.slice(1, 4) // Show up to 3 alternatives
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in coordinate-meeting:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function findAvailableSlots(freeBusyData: any, durationMinutes: number, startTime: Date, endTime: Date) {
  const slots = []
  const duration = durationMinutes * 60 * 1000 // Convert to milliseconds
  
  // Business hours: 9 AM to 6 PM UTC
  const businessStart = 9
  const businessEnd = 18
  
  const current = new Date(startTime)
  current.setHours(businessStart, 0, 0, 0)
  
  while (current < endTime) {
    // Skip weekends
    if (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1)
      current.setHours(businessStart, 0, 0, 0)
      continue
    }
    
    // Check if this slot is free for all attendees
    const slotEnd = new Date(current.getTime() + duration)
    
    // Don't go past business hours
    if (slotEnd.getHours() > businessEnd) {
      current.setDate(current.getDate() + 1)
      current.setHours(businessStart, 0, 0, 0)
      continue
    }
    
    let isSlotFree = true
    
    // Check each attendee's busy times
    for (const [email, calendar] of Object.entries(freeBusyData.calendars || {})) {
      const busyTimes = (calendar as any).busy || []
      
      for (const busyPeriod of busyTimes) {
        const busyStart = new Date(busyPeriod.start)
        const busyEnd = new Date(busyPeriod.end)
        
        // Check if our slot overlaps with busy time
        if (current < busyEnd && slotEnd > busyStart) {
          isSlotFree = false
          break
        }
      }
      
      if (!isSlotFree) break
    }
    
    if (isSlotFree) {
      slots.push({
        start: new Date(current),
        end: new Date(slotEnd)
      })
      
      // Found enough slots
      if (slots.length >= 5) break
    }
    
    // Move to next 30-minute slot
    current.setTime(current.getTime() + 30 * 60 * 1000)
  }
  
  return slots
}
