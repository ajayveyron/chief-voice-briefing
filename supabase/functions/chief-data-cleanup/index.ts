import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  table: string;
  deleted_count: number;
  criteria: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🧹 Starting Chief data cleanup...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cleanupResults: CleanupResult[] = [];

    // Calculate cleanup dates
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Clean up old processed raw events (older than 30 days)
    try {
      const { count: rawEventsCount, error: rawEventsError } = await supabase
        .from('raw_events')
        .delete()
        .eq('status', 'processed')
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      cleanupResults.push({
        table: 'raw_events',
        deleted_count: rawEventsCount || 0,
        criteria: 'processed events older than 30 days',
        success: !rawEventsError,
        error: rawEventsError?.message
      });

      console.log(`🗂️ Cleaned up ${rawEventsCount || 0} old processed raw events`);
    } catch (error) {
      console.error('❌ Error cleaning raw events:', error);
      cleanupResults.push({
        table: 'raw_events',
        deleted_count: 0,
        criteria: 'processed events older than 30 days',
        success: false,
        error: error.message
      });
    }

    // 2. Clean up old audit logs (older than 30 days)
    try {
      const { count: auditCount, error: auditError } = await supabase
        .from('event_audit_log')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      cleanupResults.push({
        table: 'event_audit_log',
        deleted_count: auditCount || 0,
        criteria: 'audit logs older than 30 days',
        success: !auditError,
        error: auditError?.message
      });

      console.log(`📋 Cleaned up ${auditCount || 0} old audit logs`);
    } catch (error) {
      console.error('❌ Error cleaning audit logs:', error);
      cleanupResults.push({
        table: 'event_audit_log',
        deleted_count: 0,
        criteria: 'audit logs older than 30 days',
        success: false,
        error: error.message
      });
    }

    // 3. Clean up old sync logs (older than 7 days)
    try {
      const { count: syncCount, error: syncError } = await supabase
        .from('integration_sync_log')
        .delete()
        .lt('created_at', sevenDaysAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      cleanupResults.push({
        table: 'integration_sync_log',
        deleted_count: syncCount || 0,
        criteria: 'sync logs older than 7 days',
        success: !syncError,
        error: syncError?.message
      });

      console.log(`🔄 Cleaned up ${syncCount || 0} old sync logs`);
    } catch (error) {
      console.error('❌ Error cleaning sync logs:', error);
      cleanupResults.push({
        table: 'integration_sync_log',
        deleted_count: 0,
        criteria: 'sync logs older than 7 days',
        success: false,
        error: error.message
      });
    }

    // 4. Clean up old failed actions (older than 7 days)
    try {
      const { count: actionsCount, error: actionsError } = await supabase
        .from('actions')
        .delete()
        .eq('status', 'failed')
        .lt('created_at', sevenDaysAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      cleanupResults.push({
        table: 'actions',
        deleted_count: actionsCount || 0,
        criteria: 'failed actions older than 7 days',
        success: !actionsError,
        error: actionsError?.message
      });

      console.log(`⚡ Cleaned up ${actionsCount || 0} old failed actions`);
    } catch (error) {
      console.error('❌ Error cleaning failed actions:', error);
      cleanupResults.push({
        table: 'actions',
        deleted_count: 0,
        criteria: 'failed actions older than 7 days',
        success: false,
        error: error.message
      });
    }

    // 5. Clean up read notifications (older than 7 days)
    try {
      const { count: notificationsCount, error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('is_read', true)
        .lt('created_at', sevenDaysAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      cleanupResults.push({
        table: 'notifications',
        deleted_count: notificationsCount || 0,
        criteria: 'read notifications older than 7 days',
        success: !notificationsError,
        error: notificationsError?.message
      });

      console.log(`🔔 Cleaned up ${notificationsCount || 0} old read notifications`);
    } catch (error) {
      console.error('❌ Error cleaning notifications:', error);
      cleanupResults.push({
        table: 'notifications',
        deleted_count: 0,
        criteria: 'read notifications older than 7 days',
        success: false,
        error: error.message
      });
    }

    // 6. Clean up old conversation history (older than 30 days)
    try {
      const { count: conversationCount, error: conversationError } = await supabase
        .from('conversation_history')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      cleanupResults.push({
        table: 'conversation_history',
        deleted_count: conversationCount || 0,
        criteria: 'conversation history older than 30 days',
        success: !conversationError,
        error: conversationError?.message
      });

      console.log(`💬 Cleaned up ${conversationCount || 0} old conversation entries`);
    } catch (error) {
      console.error('❌ Error cleaning conversation history:', error);
      cleanupResults.push({
        table: 'conversation_history',
        deleted_count: 0,
        criteria: 'conversation history older than 30 days',
        success: false,
        error: error.message
      });
    }

    // 7. Clean up orphaned OAuth states (older than 1 day)
    try {
      const { count: oauthCount, error: oauthError } = await supabase
        .from('oauth_states')
        .delete()
        .lt('created_at', oneDayAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      cleanupResults.push({
        table: 'oauth_states',
        deleted_count: oauthCount || 0,
        criteria: 'OAuth states older than 1 day',
        success: !oauthError,
        error: oauthError?.message
      });

      console.log(`🔑 Cleaned up ${oauthCount || 0} old OAuth states`);
    } catch (error) {
      console.error('❌ Error cleaning OAuth states:', error);
      cleanupResults.push({
        table: 'oauth_states',
        deleted_count: 0,
        criteria: 'OAuth states older than 1 day',
        success: false,
        error: error.message
      });
    }

    // Calculate totals
    const totalDeleted = cleanupResults.reduce((sum, result) => sum + result.deleted_count, 0);
    const successfulCleanups = cleanupResults.filter(r => r.success).length;

    // Log cleanup completion
    await supabase
      .from('event_audit_log')
      .insert({
        user_id: null,
        stage: 'data_cleanup',
        status: 'success',
        message: `Cleaned up ${totalDeleted} records across ${successfulCleanups} tables`
      });

    console.log(`✅ Data cleanup completed: ${totalDeleted} records deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data cleanup completed',
        total_deleted: totalDeleted,
        successful_cleanups: successfulCleanups,
        total_tables: cleanupResults.length,
        details: cleanupResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    console.error('❌ Error in Chief Data Cleanup:', error);
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