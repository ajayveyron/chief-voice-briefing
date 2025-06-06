
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Gmail callback function invoked with method:', req.method)
    console.log('Request URL:', req.url)
    
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    console.log('Callback parameters:', { 
      hasCode: !!code, 
      hasState: !!state, 
      error,
      codeLength: code?.length,
      stateValue: state
    })

    if (error) {
      console.error('OAuth error from Google:', error)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=oauth_error`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    if (!code || !state) {
      console.error('Missing required parameters:', { hasCode: !!code, hasState: !!state })
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=missing_params`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    
    console.log('Environment check:', { 
      supabaseUrl: !!supabaseUrl, 
      serviceRoleKey: !!serviceRoleKey,
      clientId: !!clientId,
      clientSecret: !!clientSecret,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 20)
    })

    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
      console.error('Missing environment variables:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey,
        GOOGLE_CLIENT_ID: !!clientId,
        GOOGLE_CLIENT_SECRET: !!clientSecret
      })
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=config_error`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    // Create Supabase admin client with service role key (bypasses RLS)
    console.log('Creating Supabase admin client')
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify state token using admin client
    console.log('Looking up OAuth state:', state)
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state_token', state)
      .eq('integration_type', 'gmail')
      .single()

    if (stateError) {
      console.error('Error looking up OAuth state:', stateError)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=invalid_state`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    if (!oauthState) {
      console.error('Invalid state token - no matching record found:', state)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=invalid_state`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    console.log('OAuth state found for user:', oauthState.user_id)

    // Exchange code for tokens
    console.log('Exchanging code for tokens')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: oauthState.redirect_uri || ''
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', tokenResponse.status, errorText)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=token_exchange_failed`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    const tokens = await tokenResponse.json()
    console.log('Token exchange response:', { 
      success: !tokens.error, 
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in
    })

    if (tokens.error) {
      console.error('OAuth token error:', tokens.error, tokens.error_description)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=token_error`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    // Test Gmail API access with the new token
    console.log('Testing Gmail API access')
    const gmailTestResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!gmailTestResponse.ok) {
      const errorText = await gmailTestResponse.text()
      console.error('Gmail API test failed:', gmailTestResponse.status, errorText)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=gmail_api_failed`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    const gmailProfile = await gmailTestResponse.json()
    console.log('Gmail API test successful, profile email:', gmailProfile.emailAddress)

    // Store integration using admin client
    console.log('Storing integration for user:', oauthState.user_id)
    const { error: insertError } = await supabase.from('user_integrations').upsert({
      user_id: oauthState.user_id,
      integration_type: 'gmail',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      is_active: true
    })

    if (insertError) {
      console.error('Error storing integration:', insertError)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
      const redirectUrl = `${frontendUrl}?tab=settings&error=storage_error`
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl 
        }
      })
    }

    console.log('Integration stored successfully')

    // Clean up state using admin client
    console.log('Cleaning up OAuth state')
    const { error: deleteError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id)

    if (deleteError) {
      console.error('Error cleaning up state:', deleteError)
      // Don't fail the request for cleanup errors
    }

    // Redirect back to app
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
    const redirectUrl = `${frontendUrl}?tab=settings&connected=gmail`
    
    console.log('Redirecting to:', redirectUrl)
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        Location: redirectUrl 
      }
    })
  } catch (error) {
    console.error('Unexpected error in gmail-callback:', error)
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
    const redirectUrl = `${frontendUrl}?tab=settings&error=unexpected_error`
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        Location: redirectUrl 
      }
    })
  }
})
