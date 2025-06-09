
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  includeContext?: boolean;
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

    const { message, includeContext = true }: ChatRequest = await req.json();
    console.log(`🤖 Chief AI chat for user: ${user.id}`);

    let context = {};
    let conversationHistory = '';

    if (includeContext) {
      // Get recent conversation history
      const { data: history } = await supabase
        .from('conversation_history')
        .select('message, response, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (history && history.length > 0) {
        conversationHistory = history.reverse().map(h => 
          `User: ${h.message}\nChief: ${h.response || 'No response'}\n`
        ).join('\n');
      }

      // Get recent updates for context
      const { data: recentUpdates } = await supabase
        .from('processed_updates')
        .select('source, summary, created_at, action_suggestions')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      // Get pending action items
      const { data: actionItems } = await supabase
        .from('action_items')
        .select('title, description, priority, due_date')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .limit(10);

      context = {
        conversationHistory,
        recentUpdates: recentUpdates || [],
        pendingActions: actionItems || []
      };
    }

    // Determine if this is a command that needs to execute an action
    const lowerMessage = message.toLowerCase();
    let functionToCall = null;
    let functionParams = {};

    // Email sending detection
    if (lowerMessage.includes('send') && (lowerMessage.includes('email') || lowerMessage.includes('mail'))) {
      functionToCall = 'send-email';
      // You could implement NLP here to extract email details
    }
    // Calendar event detection
    else if (lowerMessage.includes('schedule') || lowerMessage.includes('meeting') || lowerMessage.includes('calendar')) {
      functionToCall = 'manage-calendar';
    }
    // Slack message detection
    else if (lowerMessage.includes('slack') && lowerMessage.includes('send')) {
      functionToCall = 'send-slack-message';
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are Chief, a highly capable personal assistant. You have access to the user's emails, calendar, and Slack messages. You can:

1. Send emails with attachments and scheduling
2. Create, update, and delete calendar events
3. Send Slack messages to users and channels
4. Remember conversations and provide context-aware responses
5. Suggest actionable items based on user's data

Current context:
${includeContext ? `
Recent conversation history:
${conversationHistory}

Recent updates:
${context.recentUpdates?.map(u => `- ${u.source}: ${u.summary}`).join('\n')}

Pending action items:
${context.pendingActions?.map(a => `- ${a.title} (Priority: ${a.priority})`).join('\n')}
` : 'No context requested'}

Guidelines:
- Be helpful, proactive, and concise
- Reference past conversations when relevant
- Suggest specific actions the user can take
- If the user asks to send emails, schedule meetings, or send Slack messages, provide clear confirmation of what you'll do
- Format responses with emojis for better readability
- Always be professional but friendly

User message: ${message}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Save conversation to history
    const { error: historyError } = await supabase
      .from('conversation_history')
      .insert({
        user_id: user.id,
        message,
        response: aiResponse,
        context
      });

    if (historyError) {
      console.error('Error saving conversation history:', historyError);
    }

    console.log('✅ Chief AI response generated');

    return new Response(
      JSON.stringify({
        response: aiResponse,
        suggestedAction: functionToCall,
        actionParams: functionParams,
        context: includeContext ? context : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in Chief AI chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
