import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Calendar callback function invoked');
    
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('Callback parameters:', { 
      code: code ? 'present' : 'missing', 
      state: state ? 'present' : 'missing', 
      error: error || 'none' 
    });

    // Get frontend URL from environment with fallback
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://preview--chief-executive-assistant.lovable.app';    const redirectToFrontend = (path: string) => {
      const redirectUrl = new URL(path, frontendUrl);
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl.toString() 
        }
      });
    };

    // Handle OAuth errors from Google
    if (error) {
      console.error('OAuth error from Google:', error);
      return redirectToFrontend(`/?error=oauth_error&details=${encodeURIComponent(error)}`);
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing required parameters');
      return redirectToFrontend('/?error=missing_params');
    }

    // Validate environment variables
    const requiredEnvVars = {
      'SUPABASE_URL': Deno.env.get('SUPABASE_URL'),
      'SUPABASE_SERVICE_ROLE_KEY': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      'GOOGLE_CLIENT_ID': Deno.env.get('GOOGLE_CLIENT_ID'),
      'GOOGLE_CLIENT_SECRET': Deno.env.get('GOOGLE_CLIENT_SECRET')
    };

    for (const [name, value] of Object.entries(requiredEnvVars)) {
      if (!value) {
        console.error(`Missing environment variable: ${name}`);
        return redirectToFrontend('/?error=config_error');
      }
    }

    // Create Supabase admin client
    const supabase = createClient(
      requiredEnvVars['SUPABASE_URL']!,
      requiredEnvVars['SUPABASE_SERVICE_ROLE_KEY']!,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Verify state token
    console.log('Looking up OAuth state:', state);
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state_token', state)
      .eq('integration_type', 'calendar')
      .single();

    if (stateError || !oauthState) {
      console.error('Invalid state token:', stateError?.message || 'State not found');
      return redirectToFrontend('/?error=invalid_state');
    }

    console.log('OAuth state found for user:', oauthState.user_id);

    // Exchange authorization code for tokens
    console.log('Exchanging code for tokens');
    const tokenParams = new URLSearchParams({
      client_id: requiredEnvVars['GOOGLE_CLIENT_ID']!,
      client_secret: requiredEnvVars['GOOGLE_CLIENT_SECRET']!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: oauthState.redirect_uri || ''
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return redirectToFrontend('/?error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful:', { 
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in 
    });

    // Verify we got required tokens
    if (!tokens.access_token) {
      console.error('Missing access token in response');
      return redirectToFrontend('/?error=missing_access_token');
    }

    // Test Calendar API access
    console.log('Testing Calendar API access');
    const calendarTestResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!calendarTestResponse.ok) {
      const errorText = await calendarTestResponse.text();
      console.error('Calendar API test failed:', calendarTestResponse.status, errorText);
      return redirectToFrontend('/?error=calendar_api_failed');
    }

    const calendarData = await calendarTestResponse.json();
    console.log('Calendar API test successful. Calendars found:', calendarData.items?.length || 0);

    // Prepare integration data
    const integrationData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
      metadata: {
        calendar_count: calendarData.items?.length || 0,
        primary_calendar: calendarData.items?.find((c: any) => c.primary)?.id || null
      }
    };

    // Upsert integration record
    console.log('Storing integration for user:', oauthState.user_id);
    const { error: upsertError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: oauthState.user_id,
        integration_type: 'calendar',
        ...integrationData
      }, {
        onConflict: 'user_id,integration_type'
      });

    if (upsertError) {
      console.error('Error storing integration:', upsertError);
      return redirectToFrontend('/?error=storage_error');
    }

    // Clean up state
    console.log('Cleaning up OAuth state');
    await supabase
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id)
      .then(({ error }) => {
        if (error) console.error('Cleanup error (non-critical):', error);
      });

    // Successful completion
    console.log('Calendar integration completed successfully');
    return redirectToFrontend('/?connected=calendar');

  } catch (error) {
    console.error('Unexpected error in calendar-callback:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://chief-voice-briefing.lovable.app';
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        Location: `${frontendUrl}/?error=unexpected_error`
      }
    });
  }
});