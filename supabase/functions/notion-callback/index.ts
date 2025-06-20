
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://lovable.dev';

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${frontendUrl}/settings?error=oauth_error`);
    }

    if (!code || !state) {
      console.error('Missing code or state parameters');
      return Response.redirect(`${frontendUrl}/settings?error=missing_params`);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify state token
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id, redirect_uri')
      .eq('state_token', state)
      .eq('integration_type', 'notion')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      console.error('Invalid or expired state token:', stateError);
      return Response.redirect(`${frontendUrl}/settings?error=invalid_state`);
    }

    const clientId = Deno.env.get('NOTION_CLIENT_ID');
    const clientSecret = Deno.env.get('NOTION_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!clientId || !clientSecret || !supabaseUrl) {
      console.error('Missing Notion OAuth credentials');
      return Response.redirect(`${frontendUrl}/settings?error=config_error`);
    }

    const redirectUri = `${supabaseUrl}/functions/v1/notion-callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return Response.redirect(`${frontendUrl}/settings?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token response error:', tokenData.error);
      return Response.redirect(`${frontendUrl}/settings?error=token_error`);
    }

    // Test Notion API access
    try {
      const userResponse = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to access Notion API');
      }

      const userData = await userResponse.json();
      console.log('Notion user data:', userData);

    } catch (apiError) {
      console.error('Notion API test failed:', apiError);
      return Response.redirect(`${frontendUrl}/settings?error=notion_api_failed`);
    }

    // Store integration data
    const { error: insertError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: stateData.user_id,
        integration_type: 'notion',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        integration_data: {
          workspace_id: tokenData.workspace_id,
          workspace_name: tokenData.workspace_name,
          workspace_icon: tokenData.workspace_icon,
          bot_id: tokenData.bot_id,
          owner: tokenData.owner
        },
        is_active: true
      });

    if (insertError) {
      console.error('Failed to store integration:', insertError);
      return Response.redirect(`${frontendUrl}/settings?error=storage_error`);
    }

    // Clean up state token
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state_token', state);

    console.log('Notion integration successfully connected for user:', stateData.user_id);
    return Response.redirect(`${frontendUrl}/settings?connected=notion`);

  } catch (error) {
    console.error('Unexpected error in notion-callback:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://lovable.dev';
    return Response.redirect(`${frontendUrl}/settings?error=unexpected_error`);
  }
});
