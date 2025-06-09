
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    console.log(`🔍 Fetching Chief summary for user: ${user.id}`);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get today's daily summary
    const { data: todaySummary, error: summaryError } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('summary_date', today)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error fetching daily summary:', summaryError);
    }

    // Get recent unread updates (last 24 hours)
    const { data: recentUpdates, error: updatesError } = await supabase
      .from('processed_updates')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .gte('created_at', `${yesterday}T00:00:00.000Z`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (updatesError) {
      console.error('Error fetching recent updates:', updatesError);
    }

    const updates = recentUpdates || [];
    
    // Categorize updates
    const emailUpdates = updates.filter(u => u.source === 'gmail');
    const calendarUpdates = updates.filter(u => u.source === 'calendar');
    const slackUpdates = updates.filter(u => u.source === 'slack');
    const highPriorityUpdates = updates.filter(u => u.priority >= 2);

    // Get all action suggestions
    const allActions = updates.flatMap(u => u.action_suggestions || []).slice(0, 8);

    // Build greeting based on time of day
    const hour = new Date().getHours();
    let greeting = '🌅 Good morning';
    if (hour >= 12 && hour < 17) greeting = '☀️ Good afternoon';
    if (hour >= 17) greeting = '🌆 Good evening';

    // Generate response
    let response = `${greeting}! Here's your Chief summary:\n\n`;

    if (updates.length === 0) {
      response += "🎉 All caught up! No new updates to review.\n\n";
      
      // Check if there's a daily summary
      if (todaySummary) {
        response += "📊 Today's Summary:\n";
        response += `📧 ${todaySummary.email_count} emails processed\n`;
        response += `📅 ${todaySummary.calendar_count} calendar events\n`;
        response += `💬 ${todaySummary.slack_count} Slack messages\n\n`;
      }
    } else {
      response += `📊 You have ${updates.length} unread update${updates.length !== 1 ? 's' : ''}:\n`;
      
      if (emailUpdates.length > 0) {
        response += `📧 ${emailUpdates.length} email update${emailUpdates.length !== 1 ? 's' : ''}\n`;
      }
      
      if (calendarUpdates.length > 0) {
        response += `📅 ${calendarUpdates.length} calendar update${calendarUpdates.length !== 1 ? 's' : ''}\n`;
      }
      
      if (slackUpdates.length > 0) {
        response += `💬 ${slackUpdates.length} Slack update${slackUpdates.length !== 1 ? 's' : ''}\n`;
      }

      response += '\n';

      // Show high priority items first
      if (highPriorityUpdates.length > 0) {
        response += '🚨 High Priority Items:\n';
        highPriorityUpdates.slice(0, 3).forEach(update => {
          response += `• ${update.summary}\n`;
        });
        response += '\n';
      }

      // Show recent updates
      if (updates.length > highPriorityUpdates.length) {
        response += '📋 Recent Updates:\n';
        updates.filter(u => u.priority < 2).slice(0, 5).forEach(update => {
          const icon = update.source === 'gmail' ? '📧' : update.source === 'calendar' ? '📅' : '💬';
          response += `${icon} ${update.summary}\n`;
        });
        response += '\n';
      }
    }

    // Add action suggestions
    if (allActions.length > 0) {
      response += '✅ Suggested Actions:\n';
      allActions.forEach((action, index) => {
        response += `${index + 1}. ${action}\n`;
      });
      response += '\n';
    }

    // Add daily summary if available
    if (todaySummary && updates.length > 0) {
      response += `📈 Daily Stats: ${todaySummary.email_count} emails, ${todaySummary.calendar_count} events, ${todaySummary.slack_count} messages processed today\n`;
    }

    console.log(`✅ Generated Chief summary for user ${user.id}`);

    return new Response(
      JSON.stringify({
        summary: response.trim(),
        stats: {
          total_updates: updates.length,
          high_priority: highPriorityUpdates.length,
          email_updates: emailUpdates.length,
          calendar_updates: calendarUpdates.length,
          slack_updates: slackUpdates.length,
          action_suggestions: allActions.length
        },
        daily_summary: todaySummary,
        recent_updates: updates.map(u => ({
          id: u.id,
          source: u.source,
          summary: u.summary,
          priority: u.priority,
          created_at: u.created_at
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error in Chief Summary:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
