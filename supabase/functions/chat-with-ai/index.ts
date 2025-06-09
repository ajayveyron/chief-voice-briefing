
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to determine user intent and what data to fetch
function analyzeUserIntent(message: string) {
  const lowerMessage = message.toLowerCase();
  
  const intents = {
    needsEmails: [
      'email', 'mail', 'inbox', 'messages', 'unread', 'received'
    ].some(keyword => lowerMessage.includes(keyword)),
    
    needsCalendar: [
      'meeting', 'calendar', 'schedule', 'appointment', 'event', 
      'today', 'tomorrow', 'lunch', 'after', 'before', 'time'
    ].some(keyword => lowerMessage.includes(keyword)),
    
    needsSlack: [
      'slack', 'team', 'notification', 'message', 'chat', 'channel'
    ].some(keyword => lowerMessage.includes(keyword)),
    
    wantsUpdates: [
      'update', 'summary', 'overview', 'what', 'any', 'recent', 'latest'
    ].some(keyword => lowerMessage.includes(keyword))
  };

  return intents;
}

// Function to fetch Gmail data
async function fetchGmailData(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-gmail-emails');
    if (error) throw error;
    return data.emails || [];
  } catch (error) {
    console.error('Error fetching Gmail data:', error);
    return [];
  }
}

// Function to fetch Calendar data
async function fetchCalendarData(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-calendar-events');
    if (error) throw error;
    return data.events || [];
  } catch (error) {
    console.error('Error fetching Calendar data:', error);
    return [];
  }
}

// Function to fetch Slack data
async function fetchSlackData(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-slack-messages');
    if (error) throw error;
    return data.messages || [];
  } catch (error) {
    console.error('Error fetching Slack data:', error);
    return [];
  }
}

// Function to intelligently gather relevant data
async function gatherIntelligentContext(message: string, userId: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const intents = analyzeUserIntent(message);
  let context = '';
  let dataFetched = false;

  // If user wants general updates, fetch everything
  if (intents.wantsUpdates && !intents.needsEmails && !intents.needsCalendar && !intents.needsSlack) {
    console.log('🔍 User wants general updates, fetching all data sources...');
    
    const [emails, events, slackMessages] = await Promise.all([
      fetchGmailData(supabase, userId),
      fetchCalendarData(supabase, userId),
      fetchSlackData(supabase, userId)
    ]);

    if (emails.length > 0) {
      context += '\n\n📧 RECENT EMAILS:\n';
      emails.slice(0, 5).forEach((email: any) => {
        context += `- From: ${email.from}\n  Subject: ${email.subject}\n  Preview: ${email.snippet || email.body?.substring(0, 150) || 'No preview'}\n\n`;
      });
      dataFetched = true;
    }

    if (events.length > 0) {
      context += '\n\n📅 UPCOMING CALENDAR EVENTS:\n';
      events.slice(0, 5).forEach((event: any) => {
        const startTime = event.start ? new Date(event.start).toLocaleTimeString() : 'Time TBD';
        context += `- ${event.summary} at ${startTime}\n  ${event.description ? 'Details: ' + event.description.substring(0, 100) : ''}\n\n`;
      });
      dataFetched = true;
    }

    if (slackMessages.length > 0) {
      context += '\n\n💬 RECENT SLACK MESSAGES:\n';
      slackMessages.slice(0, 5).forEach((msg: any) => {
        context += `- ${msg.user || 'Someone'} in #${msg.channel || 'channel'}: ${msg.text?.substring(0, 150) || 'Message content'}\n\n`;
      });
      dataFetched = true;
    }
  } else {
    // Fetch specific data based on detected intent
    if (intents.needsEmails) {
      console.log('📧 Fetching email data based on user intent...');
      const emails = await fetchGmailData(supabase, userId);
      if (emails.length > 0) {
        context += '\n\n📧 EMAIL INFORMATION:\n';
        emails.slice(0, 5).forEach((email: any) => {
          context += `- From: ${email.from}\n  Subject: ${email.subject}\n  Preview: ${email.snippet || email.body?.substring(0, 150) || 'No preview'}\n\n`;
        });
        dataFetched = true;
      }
    }

    if (intents.needsCalendar) {
      console.log('📅 Fetching calendar data based on user intent...');
      const events = await fetchCalendarData(supabase, userId);
      if (events.length > 0) {
        context += '\n\n📅 CALENDAR INFORMATION:\n';
        events.slice(0, 5).forEach((event: any) => {
          const startTime = event.start ? new Date(event.start).toLocaleTimeString() : 'Time TBD';
          const startDate = event.start ? new Date(event.start).toLocaleDateString() : 'Date TBD';
          context += `- ${event.summary} on ${startDate} at ${startTime}\n  ${event.description ? 'Details: ' + event.description.substring(0, 100) : ''}\n\n`;
        });
        dataFetched = true;
      }
    }

    if (intents.needsSlack) {
      console.log('💬 Fetching Slack data based on user intent...');
      const slackMessages = await fetchSlackData(supabase, userId);
      if (slackMessages.length > 0) {
        context += '\n\n💬 SLACK INFORMATION:\n';
        slackMessages.slice(0, 5).forEach((msg: any) => {
          context += `- ${msg.user || 'Someone'} in #${msg.channel || 'channel'}: ${msg.text?.substring(0, 150) || 'Message content'}\n\n`;
        });
        dataFetched = true;
      }
    }
  }

  return { context, dataFetched, intents };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, messages, userUpdates, userDocuments, customInstructions } = await req.json();

    if (!prompt && (!messages || messages.length === 0)) {
      throw new Error('Either prompt or messages is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🤖 Processing intelligent assistant request...');

    // Get user query for intent analysis
    const userQuery = prompt || (messages && messages.length > 0 ? messages[messages.length - 1].content : '');
    
    // Intelligently gather relevant context based on user intent
    const { context: intelligentContext, dataFetched, intents } = await gatherIntelligentContext(userQuery, 'user-id');

    // Build enhanced system prompt
    let systemPrompt = `You are Chief, an advanced AI voice assistant that helps users manage their daily productivity through voice commands. You have access to their Gmail, Google Calendar, and Slack integrations.

IMPORTANT INSTRUCTIONS:
- You are designed for VOICE conversations, so keep responses concise and conversational
- When summarizing information, be clear and well-organized
- Always acknowledge what data you have access to and what you found
- If no relevant data is found, mention that clearly
- Use natural, spoken language - avoid overly formal text
- Prioritize the most important and recent information
- For calendar events, always mention the time and date clearly
- For emails, focus on the sender and main topic
- For Slack messages, mention the channel and key points

CONTEXT ABOUT USER'S REQUEST:
- User asked: "${userQuery}"
- Email intent detected: ${intents?.needsEmails ? 'Yes' : 'No'}
- Calendar intent detected: ${intents?.needsCalendar ? 'Yes' : 'No'}  
- Slack intent detected: ${intents?.needsSlack ? 'Yes' : 'No'}
- General updates requested: ${intents?.wantsUpdates ? 'Yes' : 'No'}
- Relevant data was ${dataFetched ? 'found and included below' : 'not found or not needed'}`;

    // Add any additional context
    let additionalContext = '';
    if (userUpdates && userUpdates.length > 0) {
      additionalContext += '\n\nUSER NOTIFICATIONS:\n';
      userUpdates.slice(0, 3).forEach((update: any) => {
        additionalContext += `- ${update.title}: ${update.summary}\n`;
      });
    }

    if (userDocuments && userDocuments.length > 0) {
      additionalContext += `\n\nUSER DOCUMENTS: ${userDocuments.length} document(s) available for reference.`;
    }

    if (customInstructions) {
      additionalContext += `\n\nCUSTOM INSTRUCTIONS: ${customInstructions}`;
    }

    // Build complete system message
    const completeSystemPrompt = systemPrompt + intelligentContext + additionalContext;

    // Build messages array
    let chatMessages;
    if (messages && Array.isArray(messages)) {
      chatMessages = messages.filter(msg => 
        msg.content && 
        typeof msg.content === 'string' && 
        msg.content.trim()
      );
      
      if (chatMessages.length > 0 && chatMessages[0]?.role === 'system') {
        chatMessages[0].content = completeSystemPrompt;
      } else {
        chatMessages.unshift({
          role: 'system',
          content: completeSystemPrompt
        });
      }
    } else if (prompt) {
      chatMessages = [
        { role: 'system', content: completeSystemPrompt },
        { role: 'user', content: prompt }
      ];
    } else {
      throw new Error('Invalid request format');
    }

    console.log('📤 Sending enhanced request to OpenAI...');

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
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('✅ Intelligent assistant response generated successfully');

    return new Response(
      JSON.stringify({ generatedText }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error in intelligent assistant function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
