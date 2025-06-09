
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, messages, userUpdates, userDocuments } = await req.json();

    if (!prompt && !messages) {
      throw new Error('Either prompt or messages is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🤖 Processing chat request...');

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

    // Build messages array based on input
    let chatMessages;
    if (messages && Array.isArray(messages)) {
      // Filter out any messages with null or empty content
      chatMessages = messages.filter(msg => 
        msg.content && 
        typeof msg.content === 'string' && 
        msg.content.trim()
      );
    } else if (prompt) {
      chatMessages = [
        { 
          role: 'system', 
          content: `You are Chief, an AI assistant that helps users manage their notifications and updates. You also have access to their uploaded documents and can answer questions about them. Be helpful, conversational, and keep responses concise for voice conversation.${contextInfo}` 
        },
        { role: 'user', content: prompt }
      ];
    } else {
      throw new Error('Invalid request format');
    }

    // Ensure we have at least one message
    if (chatMessages.length === 0) {
      chatMessages = [
        { 
          role: 'system', 
          content: `You are Chief, an AI assistant that helps users manage their notifications and updates. You also have access to their uploaded documents and can answer questions about them. Be helpful, conversational, and keep responses concise for voice conversation.${contextInfo}` 
        },
        { role: 'user', content: 'Hello' }
      ];
    } else {
      // Add context to the system message if we have one
      if (chatMessages[0]?.role === 'system' && contextInfo) {
        chatMessages[0].content += contextInfo;
      } else if (contextInfo) {
        // Insert system message with context at the beginning
        chatMessages.unshift({
          role: 'system',
          content: `You are Chief, an AI assistant that helps users manage their notifications and updates. You also have access to their uploaded documents and can answer questions about them. Be helpful, conversational, and keep responses concise for voice conversation.${contextInfo}`
        });
      }
    }

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('✅ Chat response generated');

    return new Response(
      JSON.stringify({ generatedText }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
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
