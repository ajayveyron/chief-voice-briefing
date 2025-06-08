
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

    console.log('Fetching Slack channels for user:', user.id)

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

    console.log('Fetching Slack channels and recent messages...')

    // Test auth first
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

    console.log('Auth test successful')

    // Fetch channels list
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&limit=50&exclude_archived=true', {
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
      
      if (channelsData.error === 'missing_scope') {
        return new Response(JSON.stringify({ 
          error: 'Insufficient Slack permissions',
          details: 'The Slack integration needs additional permissions to read channels and messages. Please reconnect your Slack integration with the required scopes.'
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

    console.log(`Found ${channelsData.channels?.length || 0} channels`)

    // Get recent messages from channels to determine latest activity
    const channelsWithActivity = []
    const channelsToCheck = channelsData.channels || []

    for (const channel of channelsToCheck) {
      try {
        // Get detailed channel info
        const channelInfoResponse = await fetch(`https://slack.com/api/conversations.info?channel=${channel.id}`, {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        let detailedChannel = { ...channel }
        if (channelInfoResponse.ok) {
          const channelInfoData = await channelInfoResponse.json()
          if (channelInfoData.ok) {
            detailedChannel = {
              ...channelInfoData.channel,
              purpose: channelInfoData.channel.purpose?.value,
              topic: channelInfoData.channel.topic?.value
            }
          }
        }

        // Try to get the most recent message timestamp
        let latestMessageTimestamp = null
        if (channel.is_member) {
          const messagesResponse = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=1`, {
            headers: {
              'Authorization': `Bearer ${integration.access_token}`,
              'Content-Type': 'application/json'
            }
          })

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            if (messagesData.ok && messagesData.messages && messagesData.messages.length > 0) {
              latestMessageTimestamp = parseFloat(messagesData.messages[0].ts)
            }
          }
        }

        channelsWithActivity.push({
          ...detailedChannel,
          latest_message_timestamp: latestMessageTimestamp,
          latest_message_date: latestMessageTimestamp ? new Date(latestMessageTimestamp * 1000).toISOString() : null
        })

      } catch (error) {
        console.error(`Error processing channel ${channel.name}:`, error)
        // Still add the channel but without activity data
        channelsWithActivity.push({
          ...channel,
          purpose: channel.purpose?.value,
          topic: channel.topic?.value,
          latest_message_timestamp: null,
          latest_message_date: null
        })
      }
    }

    // Sort channels by most recent message timestamp (newest first)
    channelsWithActivity.sort((a, b) => {
      if (a.latest_message_timestamp && b.latest_message_timestamp) {
        return b.latest_message_timestamp - a.latest_message_timestamp
      }
      if (a.latest_message_timestamp && !b.latest_message_timestamp) {
        return -1
      }
      if (!a.latest_message_timestamp && b.latest_message_timestamp) {
        return 1
      }
      return 0
    })

    const response = {
      channels: channelsWithActivity.map(ch => ({
        id: ch.id,
        name: ch.name,
        is_channel: ch.is_channel,
        is_private: ch.is_private,
        is_member: ch.is_member,
        num_members: ch.num_members,
        purpose: ch.purpose,
        topic: ch.topic,
        created: ch.created,
        creator: ch.creator,
        is_archived: ch.is_archived,
        is_general: ch.is_general,
        unlinked: ch.unlinked,
        name_normalized: ch.name_normalized,
        is_shared: ch.is_shared,
        is_ext_shared: ch.is_ext_shared,
        is_org_shared: ch.is_org_shared,
        pending_shared: ch.pending_shared,
        is_pending_ext_shared: ch.is_pending_ext_shared,
        is_im: ch.is_im,
        is_mpim: ch.is_mpim,
        is_group: ch.is_group,
        latest_message_timestamp: ch.latest_message_timestamp,
        latest_message_date: ch.latest_message_date
      })),
      summary: {
        total_channels: channelsWithActivity.length,
        member_channels: channelsWithActivity.filter(ch => ch.is_member).length,
        channels_with_recent_activity: channelsWithActivity.filter(ch => ch.latest_message_timestamp).length
      }
    }

    console.log(`Successfully fetched ${response.summary.total_channels} Slack channels ordered by recent activity`)

    return new Response(JSON.stringify(response), {
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
