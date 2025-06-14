
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    contentType: string;
  }>;
  scheduledFor?: string; // ISO string for scheduled sending
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const emailRequest: EmailRequest = await req.json();
    console.log(`📧 Sending email for user: ${user.id}`);

    // Get user's Gmail integration
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('integration_type', 'gmail')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      throw new Error('Gmail integration not found or inactive');
    }

    // Function to refresh token if needed
    async function refreshTokenIfExpired() {
      const now = new Date()
      const expiresAt = new Date(integration.token_expires_at)
      
      if (now >= expiresAt && integration.refresh_token) {
        console.log('Token expired, refreshing...')
        
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token'
          })
        })

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json()
          integration.access_token = tokens.access_token
          integration.token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          
          // Update in database
          await supabase
            .from('user_integrations')
            .update({
              access_token: tokens.access_token,
              token_expires_at: integration.token_expires_at,
              updated_at: new Date().toISOString()
            })
            .eq('id', integration.id)
          
          console.log('Token refreshed successfully')
        } else {
          throw new Error('Failed to refresh token')
        }
      }
    }

    await refreshTokenIfExpired()

    // If scheduled, store for later processing
    if (emailRequest.scheduledFor) {
      const { error: scheduleError } = await supabase
        .from('scheduled_tasks')
        .insert({
          user_id: user.id,
          task_type: 'email',
          title: `Send email: ${emailRequest.subject}`,
          description: `To: ${emailRequest.to.join(', ')}`,
          scheduled_for: emailRequest.scheduledFor,
          metadata: emailRequest
        });

      if (scheduleError) {
        throw scheduleError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email scheduled successfully',
          scheduledFor: emailRequest.scheduledFor
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email immediately using Gmail API
    const gmailMessage = {
      raw: btoa(
        `To: ${emailRequest.to.join(', ')}\r\n` +
        (emailRequest.cc ? `Cc: ${emailRequest.cc.join(', ')}\r\n` : '') +
        (emailRequest.bcc ? `Bcc: ${emailRequest.bcc.join(', ')}\r\n` : '') +
        `Subject: ${emailRequest.subject}\r\n` +
        `Content-Type: ${emailRequest.isHtml ? 'text/html' : 'text/plain'}; charset=utf-8\r\n\r\n` +
        emailRequest.body
      ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    };

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gmailMessage),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token and retry once
        await refreshTokenIfExpired()
        const retryResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gmailMessage),
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.text();
          throw new Error(`Gmail API error after refresh: ${error}`);
        }

        const result = await retryResponse.json();
        console.log('✅ Email sent successfully after token refresh:', result.id);

        return new Response(
          JSON.stringify({
            success: true,
            messageId: result.id,
            message: 'Email sent successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const error = await response.text();
      throw new Error(`Gmail API error: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Email sent successfully:', result.id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.id,
        message: 'Email sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
