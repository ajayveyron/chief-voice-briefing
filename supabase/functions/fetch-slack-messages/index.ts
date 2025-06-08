
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

    console.log('Fetching Slack data for user:', user.id)

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

    console.log('Testing Slack API with various endpoints...')

    // 1. Test auth and get user info
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

    console.log('Auth test successful:', authData)

    // 2. Fetch team info
    const teamInfoResponse = await fetch('https://slack.com/api/team.info', {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    let teamInfo = null
    if (teamInfoResponse.ok) {
      const teamData = await teamInfoResponse.json()
      if (teamData.ok) {
        teamInfo = {
          id: teamData.team.id,
          name: teamData.team.name,
          domain: teamData.team.domain,
          url: teamData.team.url,
          icon: teamData.team.icon
        }
        console.log('Team info fetched:', teamInfo)
      }
    }

    // 3. Fetch user list
    const usersResponse = await fetch('https://slack.com/api/users.list', {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    let users = []
    if (usersResponse.ok) {
      const usersData = await usersResponse.json()
      if (usersData.ok && usersData.members) {
        users = usersData.members.map(user => ({
          id: user.id,
          name: user.name,
          real_name: user.real_name,
          display_name: user.profile?.display_name || user.name,
          is_bot: user.is_bot,
          is_admin: user.is_admin,
          profile_image: user.profile?.image_48
        }))
        console.log(`Fetched ${users.length} users`)
      }
    }

    // 4. Fetch ALL channels without limit
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&exclude_archived=false', {
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

    console.log(`Response channels data : ${JSON.stringify(channelsData)}`);

    // 5. Get recent messages from accessible channels and detailed channel info
    const messages = []
    const detailedChannels = []
    const channelsToCheck = channelsData.channels || []

    for (const channel of channelsToCheck) {
      // Get detailed channel info
      try {
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
              // Ensure we keep the basic info
              purpose: channelInfoData.channel.purpose?.value,
              topic: channelInfoData.channel.topic?.value
            }
          }
        }
        detailedChannels.push(detailedChannel)

        // Try to get messages if we're a member
        if (channel.is_member) {
          const messagesResponse = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=300`, {
            headers: {
              'Authorization': `Bearer ${integration.access_token}`,
              'Content-Type': 'application/json'
            }
          })

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            if (messagesData.ok && messagesData.messages) {
              for (const message of messagesData.messages) {
                if (message.text && !message.bot_id) {
                  messages.push({
                    id: message.ts,
                    text: message.text,
                    user: message.user || 'Unknown',
                    channel: `#${channel.name}`,
                    timestamp: new Date(parseFloat(message.ts) * 1000).toISOString()
                  })
                }
              }
            } else {
              console.log(`Failed to get messages from channel ${channel.name}:`, messagesData.error)
            }
          }
        } else {
          console.log(`Skipping messages for channel ${channel.name} - not a member`)
        }
      } catch (error) {
        console.error(`Error processing channel ${channel.name}:`, error)
        // Still add the basic channel info
        detailedChannels.push({
          ...channel,
          purpose: channel.purpose?.value,
          topic: channel.topic?.value
        })
      }
    }

    // Sort messages by timestamp (newest first)
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // 6. Fetch user profile
    let userProfile = null
    if (authData.user_id) {
      const profileResponse = await fetch(`https://slack.com/api/users.info?user=${authData.user_id}`, {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        if (profileData.ok && profileData.user) {
          userProfile = {
            id: profileData.user.id,
            name: profileData.user.name,
            real_name: profileData.user.real_name,
            display_name: profileData.user.profile?.display_name,
            email: profileData.user.profile?.email,
            title: profileData.user.profile?.title,
            status_text: profileData.user.profile?.status_text,
            status_emoji: profileData.user.profile?.status_emoji,
            profile_image: profileData.user.profile?.image_192
          }
        }
      }
    }

    // Count accessible channels (where user is member)
    const accessibleChannels = detailedChannels.filter(ch => ch.is_member).length

    const response = {
      auth: {
        user_id: authData.user_id,
        user: authData.user,
        team: authData.team,
        url: authData.url
      },
      team: teamInfo,
      user_profile: userProfile,
      channels: detailedChannels.map(ch => ({
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
        is_group: ch.is_group
      })),
      users: users,
      messages: messages.slice(0, 100),
      summary: {
        total_channels: detailedChannels.length,
        accessible_channels: accessibleChannels,
        total_messages: messages.length,
        total_users: users.length,
        member_channels: detailedChannels.filter(ch => ch.is_member).map(ch => ch.name),
        non_member_channels: detailedChannels.filter(ch => !ch.is_member).map(ch => ch.name)
      }
    }

    console.log(`Successfully fetched comprehensive Slack data:
    - Team: ${teamInfo?.name}
    - Channels: ${response.summary.total_channels}
    - Accessible Channels: ${response.summary.accessible_channels}
    - Messages: ${response.summary.total_messages}
    - Users: ${response.summary.total_users}
    - Member of: ${response.summary.member_channels.join(', ')}
    - Not member of: ${response.summary.non_member_channels.join(', ')}`)

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
