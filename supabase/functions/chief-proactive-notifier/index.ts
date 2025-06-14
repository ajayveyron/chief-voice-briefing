import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProactiveNotification {
  user_id: string;
  type: 'deadline_reminder' | 'meeting_prep' | 'follow_up' | 'urgent_attention' | 'daily_summary';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔔 Starting proactive notifications check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active users
    const { data: activeUsers, error: usersError } = await supabase
      .from('user_integrations')
      .select('user_id')
      .eq('is_active', true);

    if (usersError) {
      throw new Error(`Failed to fetch active users: ${usersError.message}`);
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('📭 No active users for notifications');
      return new Response(
        JSON.stringify({ success: true, message: 'No active users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uniqueUsers = [...new Set(activeUsers.map(u => u.user_id))];
    const notifications: ProactiveNotification[] = [];

    for (const userId of uniqueUsers) {
      try {
        // Check for urgent unread items
        const urgentNotifications = await checkUrgentItems(supabase, userId);
        notifications.push(...urgentNotifications);

        // Check for meeting preparations
        const meetingNotifications = await checkUpcomingMeetings(supabase, userId);
        notifications.push(...meetingNotifications);

        // Check for follow-up reminders
        const followUpNotifications = await checkFollowUps(supabase, userId);
        notifications.push(...followUpNotifications);

        // Check for daily summary availability
        const summaryNotifications = await checkDailySummary(supabase, userId);
        notifications.push(...summaryNotifications);

      } catch (error) {
        console.error(`❌ Error checking notifications for user ${userId}:`, error);
      }
    }

    // Process and send notifications
    const sentNotifications = [];
    for (const notification of notifications) {
      try {
        // Store notification in database
        const { data: storedNotification, error: storeError } = await supabase
          .from('notifications')
          .insert({
            user_id: notification.user_id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            metadata: notification.metadata,
            is_read: false
          })
          .select()
          .single();

        if (storeError) {
          console.error('❌ Error storing notification:', storeError);
          continue;
        }

        // Send real-time notification if high priority
        if (notification.priority === 'high' || notification.priority === 'urgent') {
          await sendRealtimeNotification(supabase, notification);
        }

        sentNotifications.push({
          ...notification,
          id: storedNotification.id,
          sent_at: new Date().toISOString()
        });

        console.log(`📬 Sent ${notification.type} notification to user ${notification.user_id}`);

      } catch (error) {
        console.error('❌ Error sending notification:', error);
      }
    }

    // Log completion
    await supabase
      .from('event_audit_log')
      .insert({
        user_id: null,
        stage: 'proactive_notifications',
        status: 'success',
        message: `Sent ${sentNotifications.length} proactive notifications`
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Proactive notifications processed',
        total_notifications: notifications.length,
        sent_notifications: sentNotifications.length,
        notifications: sentNotifications
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    console.error('❌ Error in Chief Proactive Notifier:', error);
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

async function checkUrgentItems(supabase: any, userId: string): Promise<ProactiveNotification[]> {
  const notifications: ProactiveNotification[] = [];
  
  try {
    // Check for high-priority unread summaries
    const { data: urgentSummaries, error } = await supabase
      .from('summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('importance', 'high')
      .eq('is_viewed', false)
      .gte('processed_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()); // Last 2 hours

    if (error) {
      console.error('Error checking urgent items:', error);
      return notifications;
    }

    if (urgentSummaries && urgentSummaries.length > 0) {
      notifications.push({
        user_id: userId,
        type: 'urgent_attention',
        title: 'High Priority Items Need Attention',
        message: `You have ${urgentSummaries.length} high-priority items that require your attention.`,
        priority: 'high',
        metadata: { count: urgentSummaries.length, items: urgentSummaries.map(s => s.topic) }
      });
    }
  } catch (error) {
    console.error('Error in checkUrgentItems:', error);
  }

  return notifications;
}

async function checkUpcomingMeetings(supabase: any, userId: string): Promise<ProactiveNotification[]> {
  const notifications: ProactiveNotification[] = [];
  
  try {
    // Check for meetings in the next 30 minutes
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: upcomingEvents, error } = await supabase
      .from('raw_events')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'calendar')
      .gte('timestamp', now.toISOString())
      .lte('timestamp', thirtyMinutesFromNow.toISOString());

    if (error) {
      console.error('Error checking upcoming meetings:', error);
      return notifications;
    }

    if (upcomingEvents && upcomingEvents.length > 0) {
      for (const event of upcomingEvents) {
        const eventData = JSON.parse(event.content || '{}');
        notifications.push({
          user_id: userId,
          type: 'meeting_prep',
          title: 'Upcoming Meeting',
          message: `You have a meeting "${eventData.summary || 'Untitled'}" starting in 30 minutes.`,
          priority: 'medium',
          metadata: { event_id: event.id, event_data: eventData }
        });
      }
    }
  } catch (error) {
    console.error('Error in checkUpcomingMeetings:', error);
  }

  return notifications;
}

async function checkFollowUps(supabase: any, userId: string): Promise<ProactiveNotification[]> {
  const notifications: ProactiveNotification[] = [];
  
  try {
    // Check for pending actions older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: pendingActions, error } = await supabase
      .from('actions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lte('created_at', oneDayAgo.toISOString());

    if (error) {
      console.error('Error checking follow-ups:', error);
      return notifications;
    }

    if (pendingActions && pendingActions.length > 0) {
      notifications.push({
        user_id: userId,
        type: 'follow_up',
        title: 'Pending Actions Need Review',
        message: `You have ${pendingActions.length} actions that have been pending for over 24 hours.`,
        priority: 'medium',
        metadata: { count: pendingActions.length, actions: pendingActions.map(a => a.type) }
      });
    }
  } catch (error) {
    console.error('Error in checkFollowUps:', error);
  }

  return notifications;
}

async function checkDailySummary(supabase: any, userId: string): Promise<ProactiveNotification[]> {
  const notifications: ProactiveNotification[] = [];
  
  try {
    // Check if user has a daily summary for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: existingSummary, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('summary_date', yesterdayStr)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking daily summary:', error);
      return notifications;
    }

    // Only notify at 9 AM if there's a new summary available
    const now = new Date();
    const isNineAM = now.getHours() === 9 && now.getMinutes() < 30;

    if (existingSummary && isNineAM) {
      notifications.push({
        user_id: userId,
        type: 'daily_summary',
        title: 'Your Daily Summary is Ready',
        message: `Your daily summary for ${yesterdayStr} is available. Check your updates to see what happened yesterday.`,
        priority: 'low',
        metadata: { summary_date: yesterdayStr, summary_id: existingSummary.id }
      });
    }
  } catch (error) {
    console.error('Error in checkDailySummary:', error);
  }

  return notifications;
}

async function sendRealtimeNotification(supabase: any, notification: ProactiveNotification): Promise<void> {
  try {
    // Send via Supabase realtime channel
    const channel = supabase.channel(`notifications:${notification.user_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'notification',
      payload: notification
    });
  } catch (error) {
    console.error('Error sending realtime notification:', error);
  }
}