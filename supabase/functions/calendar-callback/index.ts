
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      return new Response('Missing code or state parameter', { status: 400 })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: oauthState } = await supabaseClient
      .from('oauth_states')
      .select('*')
      .eq('state_token', state)
      .eq('integration_type', 'calendar')
      .single()

    if (!oauthState) {
      return new Response('Invalid state token', { status: 400 })
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: oauthState.redirect_uri || ''
      })
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      return new Response(`OAuth error: ${tokens.error}`, { status: 400 })
    }

    await supabaseClient.from('user_integrations').upsert({
      user_id: oauthState.user_id,
      integration_type: 'calendar',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      is_active: true
    })

    await supabaseClient
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id)

    return new Response(null, {
      status: 302,
      headers: { Location: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'}?tab=settings&connected=calendar` }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})
