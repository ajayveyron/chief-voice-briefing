
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth token
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized');
    }

    const clientId = Deno.env.get('NOTION_CLIENT_ID');
    const clientSecret = Deno.env.get('NOTION_CLIENT_SECRET');
    const frontendUrl = Deno.env.get('FRONTEND_URL');

    if (!clientId || !clientSecret || !frontendUrl) {
      console.error('Missing environment variables');
      throw new Error('Server configuration error');
    }

    // Generate state token for OAuth security
    const stateToken = crypto.randomUUID();
    const redirectUri = `${frontendUrl}/api/notion-callback`;

    // Store state in database
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        user_id: user.id,
        state_token: stateToken,
        integration_type: 'notion',
        redirect_uri: redirectUri
      });

    if (stateError) {
      console.error('Error storing OAuth state:', stateError);
      throw new Error('Failed to initialize OAuth flow');
    }

    // Construct Notion OAuth URL
    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', stateToken);
    authUrl.searchParams.set('owner', 'user');

    console.log('Generated Notion auth URL for user:', user.id);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in notion-auth:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to initialize Notion OAuth flow'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
