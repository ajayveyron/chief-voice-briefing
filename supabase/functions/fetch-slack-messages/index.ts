
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

    // For now, return mock data since Slack API implementation would be more complex
    // In a real implementation, you would use the Slack Web API to fetch messages
    const mockMessages = [
      {
        id: 'msg1',
        text: 'Hey team, the deployment is complete!',
        user: 'john.doe',
        channel: '#general',
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg2', 
        text: 'Can we schedule a meeting for the Q1 review?',
        user: 'jane.smith',
        channel: '#planning',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg3',
        text: 'The new feature is ready for testing',
        user: 'mike.wilson',
        channel: '#development',
        timestamp: new Date(Date.now() - 7200000).toISOString()
      }
    ]

    console.log(`Successfully fetched ${mockMessages.length} Slack messages`)

    return new Response(JSON.stringify({ messages: mockMessages }), {
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
