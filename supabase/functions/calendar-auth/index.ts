import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate required environment variables
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GOOGLE_CLIENT_ID'];
    for (const envVar of requiredEnvVars) {
      if (!Deno.env.get(envVar)) {
        console.error(`Missing required environment variable: ${envVar}`);
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Extract and validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with proper auth configuration
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', {
        error: authError?.message,
        user: user ? 'present' : 'missing',
        authHeader: authHeader ? 'present' : 'missing'
      });
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          debug: process.env.NODE_ENV === 'development' ? authError?.message : undefined
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle POST requests
    if (req.method === 'POST') {
      // Generate secure state token
      const state = crypto.randomUUID();
      const redirectUri = `https://preview--chief-executive-assistant.lovable.app/functions/v1/calendar-callback`;
      
      console.log('Creating OAuth state for user:', user.id);
      
      // Clean up old OAuth states for this user (optional security measure)
      await supabaseClient
        .from('oauth_states')
        .delete()
        .eq('user_id', user.id)
        .eq('integration_type', 'calendar')
        .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Remove states older than 10 minutes

      // Store OAuth state in database with expiration
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const { error: dbError } = await supabaseClient
        .from('oauth_states')
        .insert({
          user_id: user.id,
          integration_type: 'calendar',
          state_token: state,
          redirect_uri: redirectUri,
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        });

      if (dbError) {
        console.error('Database error storing OAuth state:', dbError);
        return new Response(
          JSON.stringify({ error: 'Failed to initialize OAuth flow' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Construct Google OAuth URL with proper scopes
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const params = {
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/userinfo.email'
        ].join(' '),
        state: state,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true'
      };

      // Set URL parameters
      Object.entries(params).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });

      console.log('Generated auth URL for user:', user.email);
      
      return new Response(
        JSON.stringify({ 
          authUrl: authUrl.toString(),
          stateToken: state,
          expiresAt: expiresAt.toISOString()
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle unsupported methods
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in calendar-auth:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});