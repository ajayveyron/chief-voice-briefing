
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

    console.log('Fetching Slack messages for user:', user.id)

    // Get the user's Slack integration
    const { data: integration, error: integrationError } = await supabaseClient
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_type', 'slack')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      console.error('Slack integration not found:', integrationError)
      return new Response(JSON.stringify({ error: 'Slack integration not found or not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Found Slack integration:', integration.id)

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
      const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('SLACK_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('SLACK_CLIENT_SECRET') ?? '',
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
      
      if (!tokens.ok) {
        console.error('Token refresh error:', tokens.error)
        return new Response(JSON.stringify({ error: 'Failed to refresh access token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Update the integration with new token
      await supabaseClient
        .from('user_integrations')
        .update({
          access_token: tokens.access_token,
          token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        })
        .eq('id', integration.id)

      integration.access_token = tokens.access_token
    }

    console.log('Fetching Slack messages from Slack API...')

    // Test the token with a simple API call first
    const authTestResponse = await fetch('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!authTestResponse.ok) {
      console.error('Auth test failed:', authTestResponse.status)
      return new Response(JSON.stringify({ 
        error: 'Slack authentication failed',
        details: 'Token may be invalid or expired'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authData = await authTestResponse.json()
    if (!authData.ok) {
      console.error('Auth test error:', authData.error)
      return new Response(JSON.stringify({ 
        error: 'Slack authentication failed',
        details: authData.error
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // First, get the list of channels the user has access to
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&limit=20', {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text()
      console.error('Slack channels API error:', channelsResponse.status, errorText)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch Slack channels',
        details: errorText
      }), {
        status: channelsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const channelsData = await channelsResponse.json()
    if (!channelsData.ok) {
      console.error('Slack channels API error:', channelsData.error)
      
      // Handle specific missing scope error
      if (channelsData.error === 'missing_scope') {
        return new Response(JSON.stringify({ 
          error: 'Insufficient Slack permissions',
          details: 'The Slack integration needs additional permissions to read channels and messages. Please reconnect your Slack integration with the required scopes: channels:read, channels:history, groups:read, groups:history, im:read, im:history, mpim:read, mpim:history.'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch Slack channels',
        details: channelsData.error
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Slack channels response:', channelsData)

    // Get recent messages from the first few channels
    const messages = []
    const channelsToCheck = channelsData.channels?.slice(0, 3) || []

    for (const channel of channelsToCheck) {
      try {
        const messagesResponse = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=5`, {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          if (messagesData.ok && messagesData.messages) {
            for (const message of messagesData.messages.slice(0, 2)) {
              if (message.text && !message.bot_id) { // Skip bot messages
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

    // Sort messages by timestamp (newest first)
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    console.log(`Successfully fetched ${messages.length} Slack messages`)

    return new Response(JSON.stringify({ messages: messages.slice(0, 10) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in fetch-slack-messages:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
