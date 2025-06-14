import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DailySummaryData {
  user_id: string;
  email_count: number;
  slack_count: number;
  calendar_count: number;
  high_priority_items: any[];
  action_suggestions: any[];
  unread_summaries: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📊 Starting daily summary generation...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active users (users with integrations)
    const { data: activeUsers, error: usersError } = await supabase
      .from('user_integrations')
      .select('user_id')
      .eq('is_active', true);

    if (usersError) {
      throw new Error(`Failed to fetch active users: ${usersError.message}`);
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('📭 No active users found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active users to summarize' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uniqueUsers = [...new Set(activeUsers.map(u => u.user_id))];
    console.log(`👥 Found ${uniqueUsers.length} active users`);

    const summaryResults = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const userId of uniqueUsers) {
      try {
        console.log(`📈 Generating summary for user ${userId}`);

        // Get yesterday's activity
        const { data: rawEvents, error: eventsError } = await supabase
          .from('raw_events')
          .select('*')
          .eq('user_id', userId)
          .gte('timestamp', yesterday.toISOString())
          .lt('timestamp', todayStart.toISOString());

        if (eventsError) {
          console.error(`❌ Error fetching events for ${userId}:`, eventsError);
          continue;
        }

        // Get unread summaries
        const { data: unreadSummaries, error: summariesError } = await supabase
          .from('summaries')
          .select(`
            *,
            llm_suggestions(*)
          `)
          .eq('user_id', userId)
          .eq('is_viewed', false)
          .gte('processed_at', yesterday.toISOString());

        if (summariesError) {
          console.error(`❌ Error fetching summaries for ${userId}:`, summariesError);
          continue;
        }

        // Count events by source
        const emailCount = rawEvents?.filter(e => e.source === 'gmail').length || 0;
        const slackCount = rawEvents?.filter(e => e.source === 'slack').length || 0;
        const calendarCount = rawEvents?.filter(e => e.source === 'calendar').length || 0;

        // Get high priority items
        const highPriorityItems = unreadSummaries?.filter(s => s.importance === 'high') || [];

        // Get action suggestions
        const actionSuggestions = unreadSummaries?.flatMap(s => s.llm_suggestions || []) || [];

        // Generate AI summary
        const summaryData: DailySummaryData = {
          user_id: userId,
          email_count: emailCount,
          slack_count: slackCount,
          calendar_count: calendarCount,
          high_priority_items: highPriorityItems,
          action_suggestions: actionSuggestions,
          unread_summaries: unreadSummaries || []
        };

        const summaryText = await generateAISummary(summaryData);

        // Store daily summary
        const { error: insertError } = await supabase
          .from('daily_summaries')
          .insert({
            user_id: userId,
            summary_date: yesterday.toISOString().split('T')[0],
            summary_text: summaryText,
            email_count: emailCount,
            slack_count: slackCount,
            calendar_count: calendarCount,
            action_items: actionSuggestions.map(a => a.prompt)
          });

        if (insertError) {
          console.error(`❌ Error storing summary for ${userId}:`, insertError);
          continue;
        }

        summaryResults.push({
          user_id: userId,
          success: true,
          summary: summaryText,
          metrics: {
            emails: emailCount,
            slack_messages: slackCount,
            calendar_events: calendarCount,
            high_priority: highPriorityItems.length,
            actions: actionSuggestions.length
          }
        });

        console.log(`✅ Generated summary for user ${userId}`);

      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
        summaryResults.push({
          user_id: userId,
          success: false,
          error: error.message
        });
      }
    }

    // Log completion
    await supabase
      .from('event_audit_log')
      .insert({
        user_id: null,
        stage: 'daily_summary_generation',
        status: 'success',
        message: `Generated summaries for ${summaryResults.filter(r => r.success).length}/${uniqueUsers.length} users`
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily summaries generated',
        total_users: uniqueUsers.length,
        successful_summaries: summaryResults.filter(r => r.success).length,
        results: summaryResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    console.error('❌ Error in Chief Daily Summarizer:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

async function generateAISummary(data: DailySummaryData): Promise<string> {
  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return generateFallbackSummary(data);
    }

    const prompt = `Generate a concise daily summary for an executive based on this data:

Activity Summary:
- ${data.email_count} emails
- ${data.slack_count} Slack messages  
- ${data.calendar_count} calendar events

High Priority Items: ${data.high_priority_items.length} items
Action Suggestions: ${data.action_suggestions.length} pending actions
Unread Items: ${data.unread_summaries.length} unread summaries

Please create a brief, executive-style summary (2-3 sentences) highlighting key metrics and any important action items that need attention.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are an executive assistant creating daily summaries.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      console.warn('OpenAI API failed, using fallback summary');
      return generateFallbackSummary(data);
    }

    const result = await response.json();
    return result.choices[0].message.content || generateFallbackSummary(data);

  } catch (error) {
    console.warn('Error generating AI summary, using fallback:', error);
    return generateFallbackSummary(data);
  }
}

function generateFallbackSummary(data: DailySummaryData): string {
  const totalActivity = data.email_count + data.slack_count + data.calendar_count;
  
  if (totalActivity === 0) {
    return "No new activity yesterday. All caught up!";
  }

  let summary = `Yesterday you had ${totalActivity} total activities: ${data.email_count} emails, ${data.slack_count} Slack messages, and ${data.calendar_count} calendar events.`;
  
  if (data.high_priority_items.length > 0) {
    summary += ` You have ${data.high_priority_items.length} high-priority items requiring attention.`;
  }
  
  if (data.action_suggestions.length > 0) {
    summary += ` There are ${data.action_suggestions.length} suggested actions ready for your review.`;
  }

  return summary;
}