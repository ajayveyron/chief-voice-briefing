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
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { 
            Authorization: req.headers.get('Authorization')!,
            'Content-Type': 'application/json'
          },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle POST requests
    if (req.method === 'POST') {
      const state = crypto.randomUUID();
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-callback`;
      
      console.log('Creating OAuth state for user:', user.id);
      
      // Store OAuth state in database
      const { error: dbError } = await supabaseClient
        .from('oauth_states')
        .insert({
          user_id: user.id,
          integration_type: 'calendar',
          state_token: state,
          redirect_uri: redirectUri,
          created_at: new Date().toISOString()
        });

      if (dbError) {
        throw new Error(`Failed to store OAuth state: ${dbError.message}`);
      }

      // Construct Google OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const params = {
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        state: state,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true'
      };

      Object.entries(params).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });

      console.log('Generated auth URL for user:', user.email);

      return new Response(
        JSON.stringify({ 
          authUrl: authUrl.toString(),
          stateToken: state
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
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});