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

interface Email {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  received_at: string;
  is_read: boolean;
}

interface CalendarEventDB {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
}

interface ConversationHistory {
  message: string;
  response: string;
  created_at: string;
}

interface RecentUpdate {
  source: string;
  summary: string;
  created_at: string;
  action_suggestions?: string[];
}

interface ActionItem {
  title: string;
  description: string;
  priority: number;
  due_date?: string;
}

// Enhanced function to extract email details from AI response and user message
function extractEmailDetails(userMessage: string, aiResponse: string): EmailRequest | null {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check if this is an email sending request with more comprehensive matching
  const emailKeywords = [
    'send email', 'compose email', 'write email', 'mail to', 'email to',
    'draft an email', 'write a mail', 'send a note', 'shoot an email'
  ];
  
  if (!emailKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return null;
  }

  // Extract recipient email - improved regex for email patterns
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emails = userMessage.match(emailRegex) || [];
  
  // Extract recipient names with better pattern matching
  const namePatterns = [
    /(?:to|for|cc|bcc)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /email(?:ing)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /send(?:ing)?\s+(?:to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
  ];
  
  const foundNames = new Set<string>();
  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(userMessage)) !== null) {
      foundNames.add(match[1].trim());
    }
  }

  // If we have an email, use it; otherwise try to construct one from name
  let recipients: string[] = [];
  if (emails.length > 0) {
    recipients = emails;
  } else if (foundNames.size > 0) {
    // For demo purposes, we'll construct example emails
    recipients = Array.from(foundNames).map(name => 
      `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`
    );
  }

  if (recipients.length === 0) {
    return null;
  }

  // Extract subject with improved pattern matching and fallbacks
  let subject = '';
  const subjectPatterns = [
    /subject\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /about\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /re\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /title\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /regarding\s*[:]?\s*["']?([^"'\n]+)["']?/i
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
    } else if (lowerMessage.includes('reminder')) {
      subject = 'Friendly Reminder';
    } else {
      // Use first meaningful sentence as subject
      const firstSentence = aiResponse.split('\n')[0].split('.')[0];
      subject = firstSentence || 'Important Message';
    }
  }

  // Extract the main message content with better pattern matching
  let body = '';
  const bodyPatterns = [
    /saying\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /content\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /message\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /write\s*[:]?\s*["']?([^"'\n]+)["']?/i,
    /body\s*[:]?\s*["']?([^"'\n]+)["']?/i
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

  // Check for scheduling requests with better date parsing
  const scheduledForMatch = userMessage.match(/(?:schedule|send|deliver)\s+(?:for|on|at)\s+([^.,!?]+)/i);
  let scheduledFor = null;
  if (scheduledForMatch) {
    try {
      scheduledFor = new Date(scheduledForMatch[2]).toISOString();
    } catch (e) {
      console.warn('Failed to parse scheduled date:', scheduledForMatch[2]);
    }
  }

  return {
    to: recipients,
    subject: subject.substring(0, 200), // Limit subject length
    body: body.substring(0, 10000), // Limit body length
    isHtml,
    scheduledFor
  };
}

// Enhanced function to extract calendar event details from user message
function extractCalendarEvent(userMessage: string): CalendarEvent | null {
  const lowerMessage = userMessage.toLowerCase();
  
  // Comprehensive calendar-related request patterns
  const calendarKeywords = [
    'schedule meeting', 'create event', 'add to calendar', 'set up meeting', 
    'book meeting', 'schedule call', 'arrange meeting', 'schedule a meeting',
    'create a meeting', 'plan a meeting', 'set a meeting', 'book a call',
    'schedule an event', 'create an event', 'add event', 'new meeting',
    'meeting at', 'call at', 'event at', 'setup a call', 'organize meeting',
    'plan a call', 'arrange a meeting', 'put on calendar', 'add to my schedule'
  ];
  
  if (!calendarKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return null;
  }

  console.log('📅 Calendar event detected in message:', userMessage);

  // Extract event title/subject with improved patterns
  let summary = '';
  const titlePatterns = [
    /(?:subject|title)\s+([^,\n]+)/i,
    /meeting\s+(?:about|for|on|regarding)\s+([^,\n]+)/i,
    /(?:meeting|event|call)\s+(?:titled?|called)\s+([^,\n]+)/i,
    /(?:schedule|create|set up)\s+(?:a\s+)?(?:meeting|event|call)\s+([^,\n]+?)(?:\s+(?:at|on|for))/i,
    /for\s+([^,\n]+?)(?:\s+(?:meeting|call))/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      summary = match[1].trim();
      break;
    }
  }
  
  // If no specific title found, look for common meeting patterns
  if (!summary) {
    if (lowerMessage.includes('catchup') || lowerMessage.includes('catch up')) {
      summary = userMessage.match(/([^,\n]*(?:catchup|catch up)[^,\n]*)/i)?.[1]?.trim() || 'Catchup Meeting';
    } else if (lowerMessage.includes('sync')) {
      summary = 'Sync Meeting';
    } else if (lowerMessage.includes('standup')) {
      summary = 'Standup Meeting';
    } else if (lowerMessage.includes('review')) {
      summary = 'Review Meeting';
    } else if (lowerMessage.includes('call')) {
      summary = 'Call';
    } else if (lowerMessage.includes('discussion')) {
      summary = 'Discussion';
    } else {
      // Use first meaningful phrase as summary
      const firstPhrase = userMessage.split(/[.,!?]/)[0];
      summary = firstPhrase.length > 10 ? firstPhrase : 'Meeting';
    }
  }

  console.log('📝 Extracted meeting title:', summary);

  // Parse date and time with better handling
  let startDate = new Date();
  
  // Handle relative dates
  if (lowerMessage.includes('today')) {
    startDate = new Date();
  } else if (lowerMessage.includes('tomorrow')) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
  } else if (lowerMessage.includes('next week')) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 7 - startDate.getDay());
  } else if (lowerMessage.includes('monday')) {
    startDate = getNextWeekday(1);
  } else if (lowerMessage.includes('tuesday')) {
    startDate = getNextWeekday(2);
  } else if (lowerMessage.includes('wednesday')) {
    startDate = getNextWeekday(3);
  } else if (lowerMessage.includes('thursday')) {
    startDate = getNextWeekday(4);
  } else if (lowerMessage.includes('friday')) {
    startDate = getNextWeekday(5);
  } else if (lowerMessage.includes('saturday')) {
    startDate = getNextWeekday(6);
  } else if (lowerMessage.includes('sunday')) {
    startDate = getNextWeekday(0);
  }

  // Extract time with improved patterns
  const timePatterns = [
    /(\d{1,2})\s*(?::|\.)\s*(\d{2})\s*(am|pm)/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2})\s*(?::|\.)\s*(\d{2})/i,
    /at\s+(\d{1,2})\s*(?:o'clock)?\s*(am|pm)?/i,
    /(\d{1,2})(?::(\d{2}))?\s*(?:hrs|hours?)?\s*(am|pm)?/i
  ];

  let hours = 14; // Default to 2 PM
  let minutes = 0;

  for (const pattern of timePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      hours = parseInt(match[1]);
      minutes = match[2] ? parseInt(match[2]) : 0;
      
      // Handle AM/PM if present
      if (match[3] || match[2]?.toLowerCase?.() === 'am' || match[2]?.toLowerCase?.() === 'pm') {
        const ampm = (match[3] || match[2]).toLowerCase();
        if (ampm === 'pm' && hours !== 12) {
          hours += 12;
        } else if (ampm === 'am' && hours === 12) {
          hours = 0;
        }
      }
      break;
    }
  }

  // Set the time
  startDate.setHours(hours, minutes, 0, 0);
  
  console.log('⏰ Extracted meeting time:', startDate);

  // If the time is in the past today, move to tomorrow (unless it's explicitly for today)
  if (startDate < new Date() && !lowerMessage.includes('today')) {
    startDate.setDate(startDate.getDate() + 1);
  }

  // Calculate end time (default 1 hour, but check for duration mentions)
  let durationMinutes = 60;
  const durationMatch = userMessage.match(/(\d+)\s*(?:min|minutes?|hr|hours?)/i);
  if (durationMatch) {
    const num = parseInt(durationMatch[1]);
    if (durationMatch[0].toLowerCase().includes('hour') || 
        durationMatch[0].toLowerCase().includes('hr')) {
      durationMinutes = num * 60;
    } else {
      durationMinutes = num;
    }
  }

  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  // Extract attendees (optional)
  const attendeePatterns = [
    /with\s+([^,\n]+)/i,
    /(?:invite|include|add)\s+([^,\n]+)/i,
    /(?:participants|attendees)\s*[:]?\s*([^,\n]+)/i
  ];
  
  let attendees: Array<{ email: string; displayName?: string }> = [];
  
  for (const pattern of attendeePatterns) {
    const match = userMessage.match(pattern);
    if (match && !lowerMessage.includes('only me') && !lowerMessage.includes('just me')) {
      const names = match[1].split(/\s+(?:and|,)\s+/);
      attendees = names.map(name => ({
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        displayName: name.trim()
      }));
      break;
    }
  }

  // Extract location if mentioned
  let location: string | undefined;
  const locationMatch = userMessage.match(/(?:at|in|location)\s+([^,\n]+)/i);
  if (locationMatch) {
    location = locationMatch[1].trim();
    // Remove trailing punctuation
    location = location.replace(/[.,!?]$/, '');
  }

  const event = {
    action: 'create' as const,
    summary: summary.substring(0, 200), // Limit summary length
    description: `Meeting created via Chief AI assistant based on: "${userMessage.substring(0, 200)}"`,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'Asia/Kolkata' // IST timezone
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'Asia/Kolkata'
    },
    attendees: attendees.length > 0 ? attendees : undefined,
    location
  };

  console.log('📅 Final calendar event object:', event);
  return event;
}

// Helper function to get next weekday
function getNextWeekday(targetDay: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
  return targetDate;
}

// Function to fetch emails from the database
async function fetchEmails(supabase: any, userId: string, limit = 10): Promise<Email[]> {
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
async function fetchCalendarEvents(supabase: any, userId: string, days = 7): Promise<CalendarEventDB[]> {
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

// Function to format context for AI prompt
function formatContext(
  recentEmails: Email[],
  upcomingEvents: CalendarEventDB[],
  recentUpdates: RecentUpdate[],
  pendingActions: ActionItem[],
  conversationHistory: string
): string {
  let contextStr = '';

  if (conversationHistory) {
    contextStr += `\n\n=== Previous Conversation ===\n${conversationHistory}`;
  }

  if (recentEmails.length > 0) {
    contextStr += '\n\n=== Recent Emails ===';
    recentEmails.forEach(email => {
      contextStr += `\n- From: ${email.from}, Subject: ${email.subject}`;
      if (email.snippet) {
        contextStr += `, Snippet: ${email.snippet.substring(0, 100)}...`;
      }
    });
  }

  if (upcomingEvents.length > 0) {
    contextStr += '\n\n=== Upcoming Events ===';
    upcomingEvents.forEach(event => {
      contextStr += `\n- ${event.title} (${new Date(event.start_time).toLocaleString()})`;
      if (event.location) {
        contextStr += `, Location: ${event.location}`;
      }
    });
  }

  if (recentUpdates.length > 0) {
    contextStr += '\n\n=== Recent Updates ===';
    recentUpdates.forEach(update => {
      contextStr += `\n- ${update.source}: ${update.summary}`;
    });
  }

  if (pendingActions.length > 0) {
    contextStr += '\n\n=== Pending Actions ===';
    pendingActions.forEach(action => {
      contextStr += `\n- ${action.title} (Priority: ${action.priority})`;
      if (action.due_date) {
        contextStr += `, Due: ${new Date(action.due_date).toLocaleDateString()}`;
      }
    });
  }

  return contextStr;
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
    console.log(`🤖 Chief AI chat for user: ${user.id}, message: ${message}`);

    // Extract calendar event BEFORE calling OpenAI
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
          console.log('✅ Calendar event created successfully:', eventData);
          calendarResult = { success: true, eventId: eventData?.data?.id };
        }
      } catch (error) {
        console.error('Error calling manage-calendar function:', error);
        calendarResult = { success: false, error: error.message };
      }
    }

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
        upcomingEvents,
        calendarEventCreated: calendarResult?.success ? 'Successfully created calendar event' : null
      };
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Enhanced system prompt with better instructions
    let systemPrompt = `You are Chief, a highly capable personal assistant. You have access to the user's emails, calendar, and other productivity tools. Your role is to:

1. Understand and fulfill user requests efficiently
2. Provide context-aware responses
3. Handle email and calendar management
4. Be proactive in suggesting actions
5. Maintain a professional yet friendly tone

When handling requests:
- For emails: Confirm details before sending
- For meetings: Verify time, attendees, and purpose
- For information: Provide concise, accurate answers
- For tasks: Offer to create reminders or action items

Current time: ${new Date().toLocaleString()}`;

    if (calendarResult?.success) {
      systemPrompt += `\n\nNOTE: You successfully created a calendar event titled "${calendarEvent?.summary}"`;
      if (calendarEvent?.start?.dateTime) {
        const startTime = new Date(calendarEvent.start.dateTime);
        systemPrompt += ` scheduled for ${startTime.toLocaleString()}`;
      }
    } else if (calendarResult && !calendarResult.success) {
      systemPrompt += `\n\nNOTE: Failed to create calendar event: ${calendarResult.error}`;
    }

    // Format context information
    const contextInfo = includeContext ? formatContext(
      context.recentEmails,
      context.upcomingEvents,
      context.recentUpdates,
      context.pendingActions,
      context.conversationHistory
    ) : '';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(includeContext && contextInfo ? [{ role: 'assistant', content: `Context:${contextInfo}` }] : []),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
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
        context: includeContext ? context : null
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
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Error in Chief AI chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: Deno.env.get('DENO_ENV') === 'development' ? error.stack : undefined 
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      },
    );
  }
});