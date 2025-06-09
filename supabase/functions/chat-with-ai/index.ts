
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenAIStream, StreamingTextResponse } from 'https://esm.sh/ai@4.3.16';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, data } = await req.json();

    if (!messages) {
      throw new Error('Messages are required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🤖 Processing chat request...');

    // Extract context data from the last message's data field
    const lastMessageData = data || {};
    const { userUpdates, userDocuments, integrationData, customInstructions } = lastMessageData;

    // Build context from user data
    let contextInfo = '';
    
    if (userUpdates && userUpdates.length > 0) {
      contextInfo += '\n\nRecent notifications and updates:\n';
      userUpdates.slice(0, 10).forEach((update: any) => {
        contextInfo += `- ${update.title}: ${update.summary}\n`;
      });
    }

    if (userDocuments && userDocuments.length > 0) {
      contextInfo += '\n\nUser uploaded documents:\n';
      userDocuments.forEach((doc: any) => {
        contextInfo += `\nDocument: ${doc.name}\nContent: ${doc.content.slice(0, 1000)}${doc.content.length > 1000 ? '...' : ''}\n`;
      });
    }

    // Add integration data context
    if (integrationData && integrationData.length > 0) {
      contextInfo += '\n\nConnected integrations data:\n';
      
      integrationData.forEach((integration: any) => {
        switch (integration.source) {
          case 'gmail':
            if (integration.data && integration.data.length > 0) {
              contextInfo += '\nRecent Gmail emails:\n';
              integration.data.slice(0, 5).forEach((email: any) => {
                contextInfo += `- From: ${email.from}\n  Subject: ${email.subject}\n  Date: ${email.date}\n  Snippet: ${email.snippet}\n\n`;
              });
            }
            break;
          
          case 'calendar':
            if (integration.data && integration.data.length > 0) {
              contextInfo += '\nUpcoming calendar events:\n';
              integration.data.slice(0, 5).forEach((event: any) => {
                contextInfo += `- Event: ${event.summary}\n  Start: ${event.start}\n  End: ${event.end}\n  Location: ${event.location || 'No location'}\n\n`;
              });
            }
            break;
          
          case 'slack':
            if (integration.data) {
              contextInfo += '\nSlack workspace information:\n';
              if (integration.data.team) {
                contextInfo += `- Team: ${integration.data.team.name}\n`;
              }
              if (integration.data.channels && integration.data.channels.length > 0) {
                const memberChannels = integration.data.channels.filter((ch: any) => ch.is_member);
                contextInfo += `- Member of ${memberChannels.length} channels\n`;
              }
              if (integration.data.messages && integration.data.messages.length > 0) {
                contextInfo += '\nRecent Slack messages:\n';
                integration.data.messages.slice(0, 5).forEach((msg: any) => {
                  contextInfo += `- ${msg.channel}: ${msg.text.slice(0, 100)}${msg.text.length > 100 ? '...' : ''}\n`;
                });
              }
            }
            break;
        }
      });
    }

    // Prepare messages with system context
    const systemMessage = {
      role: 'system',
      content: `You are Chief, an AI assistant that helps users manage their notifications and updates. You also have access to their uploaded documents and connected integrations (Gmail, Calendar, Slack) and can answer questions about them. Be helpful, conversational, and keep responses concise for voice conversation.

MEETING COORDINATION CAPABILITIES:
You can help coordinate meetings by finding suitable time slots and creating calendar events. When users ask to schedule meetings:

1. Ask for required details:
   - Attendee email addresses
   - Meeting duration (default: 60 minutes)
   - Subject/title for the meeting
   - Optional: description

2. Use the coordinate-meeting function to:
   - Check availability across all attendees' calendars
   - Find suitable time slots during business hours (9 AM - 6 PM UTC, weekdays)
   - Create the meeting event with Google Meet link
   - Send invitations to all attendees

3. If no suitable slots are found, suggest alternative times or ask users to provide preferred time ranges.

Example: "I can help you schedule a meeting! Please provide the email addresses of attendees, meeting duration, and subject."

${contextInfo}

${customInstructions ? `\nCustom Instructions: ${customInstructions}` : ''}`
    };

    const chatMessages = [systemMessage, ...messages];

    // Use OpenAI with streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        max_tokens: 500,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Create a streaming response
    const stream = OpenAIStream(response);

    console.log('✅ Chat response streaming started');

    return new StreamingTextResponse(stream, { headers: corsHeaders });
  } catch (error) {
    console.error('❌ Error in chat-with-ai function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
