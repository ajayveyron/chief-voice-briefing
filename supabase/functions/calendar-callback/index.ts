import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface CalendarListResponse {
  items?: Array<{
    id: string;
    primary?: boolean;
    summary: string;
  }>;
}

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
    const errorDescription = url.searchParams.get('error_description');

    console.log('Callback parameters:', { 
      code: code ? 'present' : 'missing', 
      state: state ? 'present' : 'missing', 
      error: error || 'none',
      errorDescription: errorDescription || 'none'
    });

    // Get frontend URL from environment with fallback
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://preview--chief-executive-assistant.lovable.app';
    
    const redirectToFrontend = (path: string) => {
      try {
        const redirectUrl = new URL(path, frontendUrl);
        return new Response(null, {
          status: 302,
          headers: { 
            ...corsHeaders,
            Location: redirectUrl.toString() 
          }
        });
      } catch (urlError) {
        console.error('Invalid redirect URL:', urlError);
        return new Response('Invalid redirect URL', { 
          status: 400, 
          headers: corsHeaders 
        });
      }
    };

    // Handle OAuth errors from Google
    if (error) {
      console.error('OAuth error from Google:', { error, errorDescription });
      const errorParam = encodeURIComponent(error);
      return redirectToFrontend(`/?error=oauth_error&details=${errorParam}`);
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing required parameters:', { code: !!code, state: !!state });
      return redirectToFrontend('/?error=missing_params');
    }

    // Validate state parameter format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(state)) {
      console.error('Invalid state format:', state);
      return redirectToFrontend('/?error=invalid_state_format');
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
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Verify state token and check expiration
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

    // Check if state token has expired
    if (oauthState.expires_at && new Date(oauthState.expires_at) < new Date()) {
      console.error('State token expired:', oauthState.expires_at);
      // Clean up expired state
      await supabase
        .from('oauth_states')
        .delete()
        .eq('id', oauthState.id);
      return redirectToFrontend('/?error=state_expired');
    }

    console.log('OAuth state found for user:', oauthState.user_id);

    // Exchange authorization code for tokens
    console.log('Exchanging code for tokens');
    const tokenParams = new URLSearchParams({
      client_id: requiredEnvVars['GOOGLE_CLIENT_ID']!,
      client_secret: requiredEnvVars['GOOGLE_CLIENT_SECRET']!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: oauthState.redirect_uri || `${requiredEnvVars['SUPABASE_URL']}/functions/v1/calendar-callback`
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      });
      return redirectToFrontend('/?error=token_exchange_failed');
    }

    const tokens: OAuthTokenResponse = await tokenResponse.json();
    console.log('Token exchange successful:', { 
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope
    });

    // Verify we got required tokens
    if (!tokens.access_token) {
      console.error('Missing access token in response');
      return redirectToFrontend('/?error=missing_access_token');
    }

    // Test Calendar API access with timeout
    console.log('Testing Calendar API access');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const calendarTestResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!calendarTestResponse.ok) {
        const errorText = await calendarTestResponse.text();
        console.error('Calendar API test failed:', {
          status: calendarTestResponse.status,
          statusText: calendarTestResponse.statusText,
          error: errorText
        });
        return redirectToFrontend('/?error=calendar_api_failed');
      }

      const calendarData: CalendarListResponse = await calendarTestResponse.json();
      console.log('Calendar API test successful. Calendars found:', calendarData.items?.length || 0);

      // Prepare integration data
      const now = new Date();
      const tokenExpiresAt = new Date(now.getTime() + (tokens.expires_in * 1000));
      
      const integrationData = {
        user_id: oauthState.user_id,
        integration_type: 'calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: tokenExpiresAt.toISOString(),
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        metadata: {
          calendar_count: calendarData.items?.length || 0,
          primary_calendar: calendarData.items?.find(c => c.primary)?.id || null,
          scopes: tokens.scope?.split(' ') || [],
          token_type: tokens.token_type
        }
      };

      // Upsert integration record
      console.log('Storing integration for user:', oauthState.user_id);
      const { error: upsertError } = await supabase
        .from('user_integrations')
        .upsert(integrationData, {
          onConflict: 'user_id,integration_type'
        });

      if (upsertError) {
        console.error('Error storing integration:', upsertError);
        return redirectToFrontend('/?error=storage_error');
      }

      console.log('Integration stored successfully');

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('Calendar API test timed out');
        return redirectToFrontend('/?error=calendar_api_timeout');
      }
      console.error('Calendar API test failed with error:', fetchError);
      return redirectToFrontend('/?error=calendar_api_failed');
    }

    // Clean up state token
    console.log('Cleaning up OAuth state');
    const { error: cleanupError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id);

    if (cleanupError) {
      console.error('Cleanup error (non-critical):', cleanupError);
    }

    // Clean up any expired states for this user
    await supabase
      .from('oauth_states')
      .delete()
      .eq('user_id', oauthState.user_id)
      .lt('expires_at', new Date().toISOString())
      .then(({ error }) => {
        if (error) console.error('Expired state cleanup error (non-critical):', error);
      });

    // Successful completion
    console.log('Calendar integration completed successfully');
    return redirectToFrontend('/?connected=calendar&success=true');

  } catch (error) {
    console.error('Unexpected error in calendar-callback:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://preview--chief-executive-assistant.lovable.app';
    
    // Create a safe redirect URL
    try {
      const redirectUrl = new URL('/?error=unexpected_error', frontendUrl);
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          Location: redirectUrl.toString()
        }
      });
    } catch (urlError) {
      console.error('Error creating redirect URL:', urlError);
      return new Response('Internal server error', {
        status: 500,
        headers: corsHeaders
      });
    }
  }
});