
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
    console.log('Slack auth function invoked with method:', req.method)
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const slackClientId = Deno.env.get('SLACK_CLIENT_ID')
    const slackRedirectUri = Deno.env.get('SLACK_REDIRECT_URI') || 
                            `${supabaseUrl}/functions/v1/slack-callback`
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      hasSlackClientId: !!slackClientId,
      slackClientIdLength: slackClientId?.length || 0,
      redirectUri: slackRedirectUri
    })

    if (!slackClientId) {
      console.error('SLACK_CLIENT_ID environment variable is missing')
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Slack client ID' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseAnonKey ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      console.error('User not authenticated')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('User authenticated:', user.id)

    if (req.method === 'POST') {
      const state = crypto.randomUUID()
      
      console.log('Creating OAuth state for user:', user.id)
      console.log('Using redirect URI:', slackRedirectUri)
      
      const { error: insertError } = await supabaseClient.from('oauth_states').insert({
        user_id: user.id,
        integration_type: 'slack',
        state_token: state,
        redirect_uri: slackRedirectUri
      })

      if (insertError) {
        console.error('Error creating OAuth state:', insertError)
        return new Response(JSON.stringify({ error: 'Failed to create authentication state' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const authUrl = new URL('https://slack.com/oauth/v2/authorize')
      authUrl.searchParams.set('client_id', slackClientId)
      authUrl.searchParams.set('redirect_uri', slackRedirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', 'channels:read,chat:write,users:read')
      authUrl.searchParams.set('state', state)

      console.log('Generated auth URL:', authUrl.toString())
      console.log('Auth URL parameters:', {
        client_id: authUrl.searchParams.get('client_id'),
        redirect_uri: authUrl.searchParams.get('redirect_uri'),
        scope: authUrl.searchParams.get('scope'),
        state: authUrl.searchParams.get('state')
      })

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in slack-auth:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
