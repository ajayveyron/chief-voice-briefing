
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
      throw new Error('Unauthorized');
    }

    // Get user's Notion integration
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_type', 'notion')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      throw new Error('Notion integration not found or not active');
    }

    // Search for pages in Notion
    const searchResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'object',
          value: 'page'
        },
        page_size: 10
      })
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Notion API error:', errorText);
      throw new Error(`Notion API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    
    // Format the results
    const pages = searchData.results?.map((page: any) => ({
      id: page.id,
      title: page.properties?.title?.title?.[0]?.plain_text || 
             page.properties?.Name?.title?.[0]?.plain_text || 
             'Untitled',
      url: page.url,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      archived: page.archived
    })) || [];

    console.log(`Fetched ${pages.length} Notion pages for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        pages: pages,
        total_count: searchData.results?.length || 0,
        workspace: integration.integration_data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in fetch-notion-pages:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
