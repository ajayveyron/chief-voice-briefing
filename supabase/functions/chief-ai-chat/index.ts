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

interface CalendarEvent {
  title: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: { method: 'email' | 'popup'; minutes: number }[];
  };
}

// Enhanced function to extract email details from AI response and user message
function extractEmailDetails(userMessage: string, aiResponse: string): EmailRequest | null {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check if this is an email sending request
  const emailKeywords = ['send email', 'compose email', 'write email', 'mail to'];
  if (!emailKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return null;
  }

  // Extract recipient email - look for email patterns
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emails = userMessage.match(emailRegex) || [];
  
  // Extract recipient names (improved pattern matching)
  const namePatterns = [
    /to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /email\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /send\s+(?:to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
  ];
  
  let recipientNames: string[] = [];
  for (const pattern of namePatterns) {
    const matches = userMessage.match(pattern);
    if (matches) {
      recipientNames = matches[1].split(/\s+/);
      break;
    }
  }

  // If we have an email, use it; otherwise try to construct one from name
  let recipients: string[] = [];
  if (emails.length > 0) {
    recipients = emails;
  } else if (recipientNames.length > 0) {
    // For demo purposes, we'll construct example emails
    recipients = recipientNames.map(name => `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`);
  }

  if (recipients.length === 0) {
    return null;
  }

  // Extract subject with improved pattern matching
  let subject = '';
  const subjectPatterns = [
    /subject\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /about\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /re\s*[:]?\s*["']?([^"'\n]+)["']?/i
  ];
  
  for (const pattern of subjectPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      subject = match[1].trim();
      break;
    }
  }
  
  // Generate subject based on the message content if not explicitly provided
  if (!subject) {
    if (lowerMessage.includes('reschedule') || lowerMessage.includes('rescheduling')) {
      subject = 'Meeting Reschedule Request';
    } else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      subject = 'Thank You Note';
    } else if (lowerMessage.includes('follow') && lowerMessage.includes('up')) {
      subject = 'Follow-up Regarding Our Conversation';
    } else if (lowerMessage.includes('meeting') || lowerMessage.includes('call')) {
      subject = 'Meeting Request';
    } else {
      subject = 'Important Message';
    }
  }

  // Extract the main message content with better pattern matching
  let body = '';
  const bodyPatterns = [
    /saying\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /content\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /message\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /write\s*[:]?\s*["']?([^"'\n]+)["']?/i
  ];
  
  for (const pattern of bodyPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      body = match[1].trim();
      break;
    }
  }
  
  if (!body) {
    // If no specific content was mentioned, use the AI's response as the body
    body = aiResponse.split('\n').slice(0, 5).join('\n');
  }

  // Check for HTML content indicators
  const isHtml = lowerMessage.includes('html') || 
                 lowerMessage.includes('rich text') || 
                 lowerMessage.includes('formatted');

  // Check for scheduling requests
  const scheduledForMatch = userMessage.match(/(schedule|send)\s+(?:for|on)\s+([^.,!?]+)/i);
  let scheduledFor = null;
  if (scheduledForMatch) {
    scheduledFor = new Date(scheduledForMatch[2]).toISOString();
  }

  return {
    to: recipients,
    subject,
    body,
    isHtml,
    scheduledFor
  };
}

// Function to extract calendar event details from user message
function extractCalendarEvent(userMessage: string): CalendarEvent | null {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check if this is a calendar-related request
  const calendarKeywords = ['schedule meeting', 'create event', 'add to calendar', 'set up meeting'];
  if (!calendarKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return null;
  }

  // Extract event title
  let title = '';
  const titlePatterns = [
    /(?:meeting|event)\s+about\s+["']?([^"'\n]+)["']?/i,
    /called\s+["']?([^"'\n]+)["']?/i,
    /titled\s+["']?([^"'\n]+)["']?/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      title = match[1].trim();
      break;
    }
  }
  
  if (!title) {
    if (lowerMessage.includes('meeting')) {
      title = 'Team Meeting';
    } else if (lowerMessage.includes('call')) {
      title = 'Phone Call';
    } else {
      title = 'Calendar Event';
    }
  }

  // Extract date and time
  const dateTimePatterns = [
    /on\s+([^,]+?(?:at\s+\d+:\d+\s*(?:am|pm)?)?)/i,
    /at\s+([^,]+?(?:\son\s+\w+\s+\d+)?)/i,
    /from\s+([^,]+?)\s+to\s+([^,]+)/i
  ];
  
  let startDate = new Date();
  let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration
  
  for (const pattern of dateTimePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      try {
        if (match[2]) {
          // Handle "from X to Y" format
          startDate = new Date(match[1]);
          endDate = new Date(match[2]);
        } else {
          // Handle single date/time
          startDate = new Date(match[1]);
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        }
        break;
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
  }

  // Extract attendees
  const attendeePattern = /with\s+([^,]+?(?:\s+and\s+[^,]+)*)/i;
  const attendeesMatch = userMessage.match(attendeePattern);
  let attendees: string[] = [];
  
  if (attendeesMatch) {
    attendees = attendeesMatch[1].split(/\s+(?:and|,)\s+/).map(name => {
      // Convert names to example emails
      return `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    });
  }

  // Extract location
  let location = '';
  const locationPattern = /(?:at|in)\s+([^,]+)/i;
  const locationMatch = userMessage.match(locationPattern);
  if (locationMatch) {
    location = locationMatch[1].trim();
  }

  return {
    title,
    description: userMessage,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    attendees: attendees.length > 0 ? attendees : undefined,
    location: location || undefined,
    reminders: {
      useDefault: true
    }
  };
}

// Function to fetch emails from the database
async function fetchEmails(supabase: any, userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('user_emails')
    .select('id, subject, from, snippet, received_at, is_read')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching emails:', error);
    return [];
  }
  
  return data || [];
}

// Function to fetch calendar events from the database
async function fetchCalendarEvents(supabase: any, userId: string, days = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, description, start_time, end_time, location, attendees')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('start_time', futureDate.toISOString())
    .order('start_time', { ascending: true });
  
  if (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
  
  return data || [];
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

      // Get recent emails
      const recentEmails = await fetchEmails(supabase, user.id, 5);
      
      // Get upcoming calendar events
      const upcomingEvents = await fetchCalendarEvents(supabase, user.id, 7);

      context = {
        conversationHistory,
        recentUpdates: recentUpdates || [],
        pendingActions: actionItems || [],
        recentEmails,
        upcomingEvents
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

When the user asks you to:
- Send an email: Confirm the recipient, subject, and content before sending
- Schedule a meeting: Confirm the title, time, and attendees
- Check emails: Provide a summary of recent emails
- Check calendar: List upcoming events

Current context:
${includeContext ? `
Recent conversation history:
${conversationHistory}

Recent updates:
${context.recentUpdates?.map(u => `- ${u.source}: ${u.summary}`).join('\n')}

Pending action items:
${context.pendingActions?.map(a => `- ${a.title} (Priority: ${a.priority}, Due: ${a.due_date})`).join('\n')}

Recent emails (last 5):
${context.recentEmails?.map(e => `- From: ${e.from}, Subject: ${e.subject}, Snippet: ${e.snippet.substring(0, 50)}...`).join('\n')}

Upcoming calendar events (next 7 days):
${context.upcomingEvents?.map(e => `- ${e.title} (${new Date(e.start_time).toLocaleString()} - ${new Date(e.end_time).toLocaleString()})`).join('\n')}
` : 'No context requested'}

Guidelines:
- Be helpful, proactive, and concise
- Reference past conversations when relevant
- Suggest specific actions the user can take
- When asked to send emails or schedule events, confirm details before proceeding
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

    // Check if this is a calendar event request and extract details
    const calendarEvent = extractCalendarEvent(message);
    let calendarResult = null;
    
    if (calendarEvent) {
      try {
        console.log('📅 Creating calendar event:', calendarEvent);
        
        const { data: eventData, error: eventError } = await supabase.functions.invoke('create-calendar-event', {
          body: calendarEvent,
          headers: {
            Authorization: authHeader
          }
        });

        if (eventError) {
          console.error('Calendar event creation error:', eventError);
          calendarResult = { success: false, error: eventError.message };
        } else {
          console.log('✅ Calendar event created successfully');
          calendarResult = { success: true, eventId: eventData?.eventId };
        }
      } catch (error) {
        console.error('Error calling create-calendar-event function:', error);
        calendarResult = { success: false, error: error.message };
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
        calendarEventCreated: calendarResult,
        calendarEventDetails: calendarEvent,
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