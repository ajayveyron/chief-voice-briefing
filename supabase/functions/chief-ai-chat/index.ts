
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

interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  scheduledFor?: string;
}

// Function to extract email details from AI response and user message
function extractEmailDetails(userMessage: string, aiResponse: string): EmailRequest | null {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check if this is an email sending request
  if (!(lowerMessage.includes('send') && (lowerMessage.includes('email') || lowerMessage.includes('mail')))) {
    return null;
  }

  // Extract recipient email - look for email patterns
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emails = userMessage.match(emailRegex) || [];
  
  // Extract recipient names (simple approach - look for common patterns)
  const namePatterns = [
    /email\s+([A-Z][a-z]+)/i,
    /send\s+([A-Z][a-z]+)/i,
    /to\s+([A-Z][a-z]+)/i
  ];
  
  let recipientName = '';
  for (const pattern of namePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      recipientName = match[1];
      break;
    }
  }

  // If we have an email, use it; otherwise try to construct one from name
  let recipients: string[] = [];
  if (emails.length > 0) {
    recipients = emails;
  } else if (recipientName) {
    // For demo purposes, you might want to maintain a contact list
    // For now, we'll ask the AI to suggest an email format
    recipients = [`${recipientName.toLowerCase()}@example.com`];
  }

  if (recipients.length === 0) {
    return null;
  }

  // Extract subject and body from the message
  let subject = '';
  let body = '';
  
  // Look for subject indicators
  if (lowerMessage.includes('subject')) {
    const subjectMatch = userMessage.match(/subject[:\s]+([^.!?]+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
    }
  }
  
  // Generate subject and body based on the message content
  if (!subject) {
    if (lowerMessage.includes('reschedule') || lowerMessage.includes('rescheduling')) {
      subject = 'Meeting Reschedule';
    } else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      subject = 'Thank you';
    } else if (lowerMessage.includes('follow') && lowerMessage.includes('up')) {
      subject = 'Follow-up';
    } else {
      subject = 'Quick message';
    }
  }

  // Extract the main message content
  const messagePatterns = [
    /saying\s+(.+)$/i,
    /that\s+(.+)$/i,
    /about\s+(.+)$/i,
  ];
  
  for (const pattern of messagePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      body = match[1].trim();
      break;
    }
  }
  
  if (!body) {
    body = userMessage; // Use the full message as fallback
  }

  return {
    to: recipients,
    subject,
    body,
    isHtml: false
  };
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

When the user asks you to send an email, you should:
- Acknowledge that you'll send the email
- Confirm the recipient, subject, and content
- Be clear about what action you're taking

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
- If the user asks to send emails, confirm what you'll do and then actually do it
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

    // Check if this is an email sending request and extract details
    const emailDetails = extractEmailDetails(message, aiResponse);
    let emailResult = null;
    
    if (emailDetails) {
      try {
        console.log('📧 Sending email:', emailDetails);
        
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
          body: emailDetails,
          headers: {
            Authorization: authHeader
          }
        });

        if (emailError) {
          console.error('Email sending error:', emailError);
          emailResult = { success: false, error: emailError.message };
        } else {
          console.log('✅ Email sent successfully');
          emailResult = { success: true, messageId: emailData?.messageId };
        }
      } catch (error) {
        console.error('Error calling send-email function:', error);
        emailResult = { success: false, error: error.message };
      }
    }

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
        emailSent: emailResult,
        emailDetails: emailDetails,
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
