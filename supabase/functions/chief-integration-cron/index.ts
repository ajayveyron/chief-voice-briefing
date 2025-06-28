
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserIntegration {
  id: string;
  user_id: string;
  integration_type: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  is_active: boolean;
}

interface IntegrationProcessor {
  type: string;
  functionName: string;
  needsTokenRefresh: boolean;
}

const INTEGRATION_PROCESSORS: IntegrationProcessor[] = [
  { type: 'gmail', functionName: 'fetch-gmail-emails', needsTokenRefresh: true },
  { type: 'calendar', functionName: 'fetch-calendar-events', needsTokenRefresh: true },
  { type: 'slack', functionName: 'fetch-slack-messages', needsTokenRefresh: true },
  { type: 'notion', functionName: 'fetch-notion-pages', needsTokenRefresh: false },
];

async function refreshGoogleToken(integration: UserIntegration, supabase: any): Promise<string | null> {
  if (!integration.refresh_token) {
    console.error(`No refresh token available for user ${integration.user_id}, integration ${integration.integration_type}`);
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: integration.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      console.error(`Token refresh failed for user ${integration.user_id}:`, await response.text());
      return null;
    }

    const tokens = await response.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update the integration with new token
    const { error } = await supabase
      .from('user_integrations')
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (error) {
      console.error(`Failed to update token for user ${integration.user_id}:`, error);
      return null;
    }

    console.log(`✅ Token refreshed successfully for user ${integration.user_id}, integration ${integration.integration_type}`);
    return tokens.access_token;

  } catch (error) {
    console.error(`Error refreshing token for user ${integration.user_id}:`, error);
    return null;
  }
}

async function refreshSlackToken(integration: UserIntegration, supabase: any): Promise<string | null> {
  if (!integration.refresh_token) {
    console.error(`No refresh token available for user ${integration.user_id}, integration ${integration.integration_type}`);
    return null;
  }

  try {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('SLACK_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('SLACK_CLIENT_SECRET') ?? '',
        refresh_token: integration.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      console.error(`Slack token refresh failed for user ${integration.user_id}:`, await response.text());
      return null;
    }

    const tokens = await response.json();
    
    if (!tokens.ok) {
      console.error(`Slack token refresh error for user ${integration.user_id}:`, tokens.error);
      return null;
    }

    const newExpiresAt = tokens.expires_in ? 
      new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    // Update the integration with new token
    const { error } = await supabase
      .from('user_integrations')
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (error) {
      console.error(`Failed to update Slack token for user ${integration.user_id}:`, error);
      return null;
    }

    console.log(`✅ Slack token refreshed successfully for user ${integration.user_id}`);
    return tokens.access_token;

  } catch (error) {
    console.error(`Error refreshing Slack token for user ${integration.user_id}:`, error);
    return null;
  }
}

async function ensureValidToken(integration: UserIntegration, supabase: any): Promise<string | null> {
  // Check if token is expired or about to expire (within 5 minutes)
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log(`🔄 Token expired/expiring for user ${integration.user_id}, integration ${integration.integration_type}. Refreshing...`);
    
    switch (integration.integration_type) {
      case 'gmail':
      case 'calendar':
        return await refreshGoogleToken(integration, supabase);
      case 'slack':
        return await refreshSlackToken(integration, supabase);
      default:
        console.log(`No token refresh logic for integration type: ${integration.integration_type}`);
        return integration.access_token;
    }
  }

  return integration.access_token;
}

async function processIntegration(integration: UserIntegration, processor: IntegrationProcessor, supabase: any) {
  try {
    console.log(`🔄 Processing ${processor.type} for user ${integration.user_id}`);

    // Ensure we have a valid token
    let validToken = integration.access_token;
    if (processor.needsTokenRefresh) {
      validToken = await ensureValidToken(integration, supabase);
      if (!validToken) {
        console.error(`❌ Failed to get valid token for user ${integration.user_id}, integration ${processor.type}`);
        return;
      }
    }

    // Call the integration function
    const { data, error } = await supabase.functions.invoke(processor.functionName, {
      body: { 
        user_id: integration.user_id,
        access_token: validToken 
      },
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      }
    });

    if (error) {
      console.error(`❌ Error calling ${processor.functionName} for user ${integration.user_id}:`, error);
      return;
    }

    // Log the output as requested
    console.log(`THIS_IS_INTEGRATIONS_DATA ${processor.type} ${integration.user_id}:`, JSON.stringify(data));

  } catch (error) {
    console.error(`❌ Error processing ${processor.type} for user ${integration.user_id}:`, error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Chief Integration Cron started at:', new Date().toISOString());

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active user integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('is_active', true);

    if (integrationsError) {
      console.error('❌ Error fetching integrations:', integrationsError);
      throw integrationsError;
    }

    console.log(`📊 Found ${integrations?.length || 0} active integrations`);

    if (!integrations || integrations.length === 0) {
      console.log('✅ No active integrations found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active integrations found',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group integrations by user and type for processing
    const integrationsByType = integrations.reduce((acc, integration) => {
      const key = `${integration.user_id}-${integration.integration_type}`;
      acc[key] = integration;
      return acc;
    }, {} as Record<string, UserIntegration>);

    let processedCount = 0;

    // Process each integration
    for (const [key, integration] of Object.entries(integrationsByType)) {
      const processor = INTEGRATION_PROCESSORS.find(p => p.type === integration.integration_type);
      
      if (!processor) {
        console.log(`⚠️ No processor found for integration type: ${integration.integration_type}`);
        continue;
      }

      await processIntegration(integration, processor, supabase);
      processedCount++;
    }

    console.log(`✅ Chief Integration Cron completed. Processed ${processedCount} integrations`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Integration cron completed successfully',
      processed: processedCount,
      total_integrations: integrations.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in Chief Integration Cron:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
