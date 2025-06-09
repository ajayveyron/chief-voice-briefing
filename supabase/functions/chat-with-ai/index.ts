
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to search external data sources (placeholder for expansion)
async function searchExternalData(query: string, userUpdates: any[], userDocuments: any[]) {
  let context = '';
  
  // Search through user updates
  if (userUpdates && userUpdates.length > 0) {
    const relevantUpdates = userUpdates.filter(update => 
      update.title?.toLowerCase().includes(query.toLowerCase()) ||
      update.summary?.toLowerCase().includes(query.toLowerCase())
    );
    
    if (relevantUpdates.length > 0) {
      context += '\n\nRelevant notifications:\n';
      relevantUpdates.slice(0, 5).forEach(update => {
        context += `- ${update.title}: ${update.summary}\n`;
      });
    }
  }
  
  // Search through user documents
  if (userDocuments && userDocuments.length > 0) {
    const relevantDocs = userDocuments.filter(doc => 
      doc.name?.toLowerCase().includes(query.toLowerCase()) ||
      doc.content?.toLowerCase().includes(query.toLowerCase())
    );
    
    if (relevantDocs.length > 0) {
      context += '\n\nRelevant documents:\n';
      relevantDocs.slice(0, 3).forEach(doc => {
        const snippet = doc.content?.slice(0, 200) || '';
        context += `Document "${doc.name}": ${snippet}${snippet.length === 200 ? '...' : ''}\n`;
      });
    }
  }
  
  return context;
}

// Function to determine if we need to search external data
function shouldSearchExternalData(message: string): boolean {
  const searchTriggers = [
    'find', 'search', 'look for', 'show me', 'what about',
    'do I have', 'any updates', 'notifications', 'documents',
    'recent', 'latest', 'when', 'where', 'who', 'how'
  ];
  
  return searchTriggers.some(trigger => 
    message.toLowerCase().includes(trigger)
  );
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

    console.log('🤖 Processing chat request...');

    // Determine the user's query for context searching
    const userQuery = prompt || (messages && messages.length > 0 ? messages[messages.length - 1].content : '');
    
    // Build enhanced context from user data
    let contextInfo = '';
    
    // Always include recent updates summary
    if (userUpdates && userUpdates.length > 0) {
      contextInfo += '\n\nUser\'s recent notifications summary:\n';
      userUpdates.slice(0, 5).forEach((update: any) => {
        contextInfo += `- ${update.title}: ${update.summary}\n`;
      });
    }

    // Include document availability info
    if (userDocuments && userDocuments.length > 0) {
      contextInfo += `\n\nUser has ${userDocuments.length} uploaded document(s) available for reference.`;
    }

    // Search for relevant external data if needed
    if (shouldSearchExternalData(userQuery)) {
      console.log('🔍 Searching external data sources...');
      const searchResults = await searchExternalData(userQuery, userUpdates, userDocuments);
      if (searchResults) {
        contextInfo += searchResults;
      }
    }

    // Include custom instructions if provided
    if (customInstructions) {
      contextInfo += `\n\nCustom user instructions: ${customInstructions}`;
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
      
      // Enhance system message with context
      if (chatMessages.length > 0 && chatMessages[0]?.role === 'system') {
        chatMessages[0].content += contextInfo;
      } else {
        // Insert enhanced system message at the beginning
        chatMessages.unshift({
          role: 'system',
          content: `You are Chief, an advanced AI voice assistant that helps users manage their daily tasks, notifications, and information. You have access to their uploaded documents and recent notifications. You should be conversational, helpful, and provide concise responses optimized for voice interaction. When users ask about their data, search through their notifications and documents to provide relevant information.${contextInfo}`
        });
      }
    } else if (prompt) {
      chatMessages = [
        { 
          role: 'system', 
          content: `You are Chief, an advanced AI voice assistant that helps users manage their daily tasks, notifications, and information. You have access to their uploaded documents and recent notifications. You should be conversational, helpful, and provide concise responses optimized for voice interaction. When users ask about their data, search through their notifications and documents to provide relevant information.${contextInfo}` 
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
          content: `You are Chief, an advanced AI voice assistant. You help users with their daily tasks and provide information. Be conversational and concise for voice interaction.${contextInfo}` 
        },
        { role: 'user', content: 'Hello' }
      ];
    }

    console.log('📤 Sending request to OpenAI...');

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

    console.log('✅ Chat response generated successfully');

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
