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
  action: 'create' | 'read';
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
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

// Enhanced function to extract calendar event details from user message
function extractCalendarEvent(userMessage: string): CalendarEvent | null {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check if this is a calendar-related request
  const calendarKeywords = ['schedule meeting', 'create event', 'add to calendar', 'set up meeting', 'book meeting', 'schedule call', 'arrange meeting'];
  if (!calendarKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return null;
  }

  // Extract event title
  let summary = '';
  const titlePatterns = [
    /(?:meeting|event|call)\s+(?:about|for|with|titled)\s+["']?([^"'\n,]+)["']?/i,
    /called\s+["']?([^"'\n,]+)["']?/i,
    /titled\s+["']?([^"'\n,]+)["']?/i,
    /meeting\s+["']?([^"'\n,]+)["']?/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      summary = match[1].trim();
      break;
    }
  }
  
  if (!summary) {
    if (lowerMessage.includes('sync')) {
      summary = 'Team Sync Meeting';
    } else if (lowerMessage.includes('call')) {
      summary = 'Phone Call';
    } else if (lowerMessage.includes('standup')) {
      summary = 'Daily Standup';
    } else {
      summary = 'Meeting';
    }
  }

  // Extract date and time with better parsing
  let startDate = new Date();
  let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration
  
  // Look for time patterns
  const timePatterns = [
    /at\s+(\d+(?::\d+)?\s*(?:am|pm))/i,
    /(\d+(?::\d+)?\s*(?:am|pm))/i
  ];
  
  // Look for date patterns
  const datePatterns = [
    /(?:on\s+)?(\w+day)/i, // Monday, Tuesday, etc.
    /(?:on\s+)?(\w+\s+\d+)/i, // January 15, etc.
    /(today|tomorrow|next\s+week)/i,
    /(this\s+\w+day)/i // this Monday, etc.
  ];

  let timeMatch = null;
  let dateMatch = null;

  // Extract time
  for (const pattern of timePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      timeMatch = match[1];
      break;
    }
  }

  // Extract date
  for (const pattern of datePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      dateMatch = match[1];
      break;
    }
  }

  // Parse the extracted date and time
  try {
    if (dateMatch && timeMatch) {
      // Combine date and time
      const dateTimeStr = `${dateMatch} ${timeMatch}`;
      startDate = new Date(dateTimeStr);
    } else if (timeMatch) {
      // Just time, assume today
      const today = new Date();
      const timeStr = `${today.toDateString()} ${timeMatch}`;
      startDate = new Date(timeStr);
    } else if (dateMatch) {
      // Just date, assume a default time (e.g., 2 PM)
      const dateTimeStr = `${dateMatch} 2:00 PM`;
      startDate = new Date(dateTimeStr);
    }
    
    // If the parsed date is in the past, move it to tomorrow
    if (startDate < new Date()) {
      startDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
  } catch (e) {
    console.error('Error parsing date/time:', e);
    // Fallback to default times
    startDate = new Date();
    startDate.setHours(startDate.getHours() + 1); // 1 hour from now
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  // Extract attendees
  const attendeePattern = /with\s+([^,]+?(?:\s+and\s+[^,]+)*)/i;
  const attendeesMatch = userMessage.match(attendeePattern);
  let attendees: Array<{ email: string; displayName?: string }> = [];
  
  if (attendeesMatch) {
    const names = attendeesMatch[1].split(/\s+(?:and|,)\s+/);
    attendees = names.map(name => ({
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      displayName: name.trim()
    }));
  }

  // Extract location
  let location = '';
  const locationPattern = /(?:at|in)\s+([^,\n]+)/i;
  const locationMatch = userMessage.match(locationPattern);
  if (locationMatch) {
    location = locationMatch[1].trim();
  }

  return {
    action: 'create',
    summary,
    description: `Meeting scheduled via Chief AI: ${userMessage}`,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/New_York' // Default timezone, could be made configurable
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/New_York'
    },
    attendees: attendees.length > 0 ? attendees : undefined,
    location: location || undefined
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

Always be helpful, proactive, and concise. When asked to schedule meetings or send emails, provide clear confirmations of what you're doing.

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
        
        const { data: eventData, error: eventError } = await supabase.functions.invoke('manage-calendar', {
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
          calendarResult = { success: true, eventId: eventData?.data?.id };
        }
      } catch (error) {
        console.error('Error calling manage-calendar function:', error);
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
        context: includeContext ? {} : null
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
        context: includeContext ? {} : null
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
