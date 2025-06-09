
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessedUpdate {
  user_id: string;
  source: string;
  source_id: string;
  content: any;
  summary?: string;
  action_suggestions?: string[];
  priority?: number;
}

// Function to generate AI summary for collected data
async function generateSummary(content: any, source: string): Promise<{ summary: string; actions: string[]; priority: number }> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.warn('OpenAI API key not configured - returning basic summary');
    return {
      summary: `${source} update: ${JSON.stringify(content).substring(0, 100)}...`,
      actions: [`Review ${source} update`],
      priority: 1
    };
  }

  try {
    const prompt = `
You are Chief, a personal assistant. Analyze this ${source} data and provide:
1. A concise summary (max 100 characters)
2. Up to 3 specific action items
3. Priority level (1=low, 2=medium, 3=high)

Data: ${JSON.stringify(content)}

Respond in this JSON format:
{
  "summary": "Brief summary here",
  "actions": ["Action 1", "Action 2"],
  "priority": 2
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return {
      summary: result.summary || `${source} update`,
      actions: result.actions || [`Review ${source} update`],
      priority: result.priority || 1
    };
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return {
      summary: `${source} update: ${JSON.stringify(content).substring(0, 50)}...`,
      actions: [`Review ${source} update`],
      priority: 1
    };
  }
}

// Function to fetch and process Gmail emails
async function processGmailData(supabase: any): Promise<ProcessedUpdate[]> {
  console.log('🔄 Processing Gmail data...');
  const updates: ProcessedUpdate[] = [];

  try {
    // Get all active Gmail integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('user_id, access_token')
      .eq('integration_type', 'gmail')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching Gmail integrations:', intError);
      return updates;
    }

    console.log(`📧 Found ${integrations?.length || 0} Gmail integrations`);

    for (const integration of integrations || []) {
      try {
        // Call the existing fetch-gmail-emails function
        const { data: emailData, error: emailError } = await supabase.functions.invoke('fetch-gmail-emails', {
          headers: {
            Authorization: `Bearer ${integration.access_token}`
          }
        });

        if (emailError) {
          console.error(`Error fetching emails for user ${integration.user_id}:`, emailError);
          continue;
        }

        const emails = emailData?.emails || [];
        console.log(`📧 Processing ${emails.length} emails for user ${integration.user_id}`);

        for (const email of emails) {
          // Check if we've already processed this email
          const { data: existing } = await supabase
            .from('processed_updates')
            .select('id')
            .eq('user_id', integration.user_id)
            .eq('source', 'gmail')
            .eq('source_id', email.id)
            .single();

          if (existing) {
            continue; // Skip already processed emails
          }

          // Generate AI summary
          const { summary, actions, priority } = await generateSummary(email, 'gmail');

          updates.push({
            user_id: integration.user_id,
            source: 'gmail',
            source_id: email.id,
            content: email,
            summary,
            action_suggestions: actions,
            priority
          });
        }
      } catch (error) {
        console.error(`Error processing Gmail for user ${integration.user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in Gmail processing:', error);
  }

  return updates;
}

// Function to fetch and process Calendar events
async function processCalendarData(supabase: any): Promise<ProcessedUpdate[]> {
  console.log('🔄 Processing Calendar data...');
  const updates: ProcessedUpdate[] = [];

  try {
    // Get all active Calendar integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('user_id, access_token')
      .eq('integration_type', 'calendar')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching Calendar integrations:', intError);
      return updates;
    }

    console.log(`📅 Found ${integrations?.length || 0} Calendar integrations`);

    for (const integration of integrations || []) {
      try {
        // Call the existing fetch-calendar-events function
        const { data: calendarData, error: calendarError } = await supabase.functions.invoke('fetch-calendar-events', {
          headers: {
            Authorization: `Bearer ${integration.access_token}`
          }
        });

        if (calendarError) {
          console.error(`Error fetching calendar for user ${integration.user_id}:`, calendarError);
          continue;
        }

        const events = calendarData?.events || [];
        console.log(`📅 Processing ${events.length} events for user ${integration.user_id}`);

        for (const event of events) {
          // Check if we've already processed this event
          const { data: existing } = await supabase
            .from('processed_updates')
            .select('id')
            .eq('user_id', integration.user_id)
            .eq('source', 'calendar')
            .eq('source_id', event.id)
            .single();

          if (existing) {
            continue; // Skip already processed events
          }

          // Generate AI summary
          const { summary, actions, priority } = await generateSummary(event, 'calendar');

          updates.push({
            user_id: integration.user_id,
            source: 'calendar',
            source_id: event.id,
            content: event,
            summary,
            action_suggestions: actions,
            priority
          });
        }
      } catch (error) {
        console.error(`Error processing Calendar for user ${integration.user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in Calendar processing:', error);
  }

  return updates;
}

// Function to fetch and process Slack messages
async function processSlackData(supabase: any): Promise<ProcessedUpdate[]> {
  console.log('🔄 Processing Slack data...');
  const updates: ProcessedUpdate[] = [];

  try {
    // Get all active Slack integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('user_id, access_token')
      .eq('integration_type', 'slack')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching Slack integrations:', intError);
      return updates;
    }

    console.log(`💬 Found ${integrations?.length || 0} Slack integrations`);

    for (const integration of integrations || []) {
      try {
        // Call the existing fetch-slack-messages function
        const { data: slackData, error: slackError } = await supabase.functions.invoke('fetch-slack-messages', {
          headers: {
            Authorization: `Bearer ${integration.access_token}`
          }
        });

        if (slackError) {
          console.error(`Error fetching Slack for user ${integration.user_id}:`, slackError);
          continue;
        }

        const messages = slackData?.messages || [];
        console.log(`💬 Processing ${messages.length} messages for user ${integration.user_id}`);

        for (const message of messages) {
          // Check if we've already processed this message
          const { data: existing } = await supabase
            .from('processed_updates')
            .select('id')
            .eq('user_id', integration.user_id)
            .eq('source', 'slack')
            .eq('source_id', message.ts || message.id)
            .single();

          if (existing) {
            continue; // Skip already processed messages
          }

          // Generate AI summary
          const { summary, actions, priority } = await generateSummary(message, 'slack');

          updates.push({
            user_id: integration.user_id,
            source: 'slack',
            source_id: message.ts || message.id,
            content: message,
            summary,
            action_suggestions: actions,
            priority
          });
        }
      } catch (error) {
        console.error(`Error processing Slack for user ${integration.user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in Slack processing:', error);
  }

  return updates;
}

// Function to save processed updates to database
async function saveProcessedUpdates(supabase: any, updates: ProcessedUpdate[]) {
  if (updates.length === 0) {
    console.log('💾 No updates to save');
    return;
  }

  console.log(`💾 Saving ${updates.length} processed updates...`);

  for (const update of updates) {
    try {
      const { error } = await supabase
        .from('processed_updates')
        .insert(update);

      if (error) {
        console.error('Error saving update:', error, update);
      }
    } catch (error) {
      console.error('Error saving update:', error);
    }
  }

  console.log('✅ Finished saving processed updates');
}

// Function to generate daily summaries
async function generateDailySummaries(supabase: any) {
  console.log('📊 Generating daily summaries...');

  const today = new Date().toISOString().split('T')[0];

  try {
    // Get all users with updates from today
    const { data: usersWithUpdates, error } = await supabase
      .from('processed_updates')
      .select('user_id')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`);

    if (error) {
      console.error('Error fetching users with updates:', error);
      return;
    }

    const uniqueUsers = [...new Set(usersWithUpdates?.map(u => u.user_id) || [])];
    console.log(`📊 Generating summaries for ${uniqueUsers.length} users`);

    for (const userId of uniqueUsers) {
      try {
        // Get today's updates for this user
        const { data: todayUpdates, error: updateError } = await supabase
          .from('processed_updates')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lt('created_at', `${today}T23:59:59.999Z`)
          .order('priority', { ascending: false });

        if (updateError) {
          console.error(`Error fetching updates for user ${userId}:`, updateError);
          continue;
        }

        const updates = todayUpdates || [];
        const emailCount = updates.filter(u => u.source === 'gmail').length;
        const calendarCount = updates.filter(u => u.source === 'calendar').length;
        const slackCount = updates.filter(u => u.source === 'slack').length;

        // Generate summary text
        const highPriorityUpdates = updates.filter(u => u.priority >= 2);
        const allActions = updates.flatMap(u => u.action_suggestions || []).slice(0, 5);

        const summaryText = `
🔔 Daily Summary for ${today}
📧 ${emailCount} email updates
📅 ${calendarCount} calendar updates  
💬 ${slackCount} Slack updates

${highPriorityUpdates.length > 0 ? '🚨 High Priority Items:\n' + highPriorityUpdates.map(u => `- ${u.summary}`).join('\n') : ''}

${updates.length > 0 ? '📋 Recent Updates:\n' + updates.slice(0, 5).map(u => `- ${u.summary}`).join('\n') : 'No updates today'}
        `.trim();

        // Upsert daily summary
        const { error: summaryError } = await supabase
          .from('daily_summaries')
          .upsert({
            user_id: userId,
            summary_date: today,
            email_count: emailCount,
            calendar_count: calendarCount,
            slack_count: slackCount,
            summary_text: summaryText,
            action_items: allActions,
            updated_at: new Date().toISOString()
          });

        if (summaryError) {
          console.error(`Error saving summary for user ${userId}:`, summaryError);
        } else {
          console.log(`✅ Generated summary for user ${userId}`);
        }
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in daily summary generation:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🤖 Chief Data Collector starting...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process all data sources in parallel
    const [gmailUpdates, calendarUpdates, slackUpdates] = await Promise.all([
      processGmailData(supabase),
      processCalendarData(supabase),
      processSlackData(supabase)
    ]);

    // Combine all updates
    const allUpdates = [...gmailUpdates, ...calendarUpdates, ...slackUpdates];
    console.log(`📊 Total updates collected: ${allUpdates.length}`);

    // Save to database
    await saveProcessedUpdates(supabase, allUpdates);

    // Generate daily summaries
    await generateDailySummaries(supabase);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Chief Data Collector completed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        updates_processed: allUpdates.length,
        processing_time_ms: processingTime,
        breakdown: {
          gmail: gmailUpdates.length,
          calendar: calendarUpdates.length,
          slack: slackUpdates.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error in Chief Data Collector:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
