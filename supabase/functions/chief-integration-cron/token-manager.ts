
import { UserIntegration } from './types.ts';

export async function refreshGoogleToken(integration: UserIntegration, supabase: any): Promise<string | null> {
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

export async function refreshSlackToken(integration: UserIntegration, supabase: any): Promise<string | null> {
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

export async function ensureValidToken(integration: UserIntegration, supabase: any): Promise<string | null> {
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
