
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ChiefStats {
  total_updates: number;
  high_priority: number;
  email_updates: number;
  calendar_updates: number;
  slack_updates: number;
  action_suggestions: number;
}

interface ChiefSummaryResponse {
  summary: string;
  stats: ChiefStats;
  daily_summary?: any;
  recent_updates: Array<{
    id: string;
    source: string;
    summary: string;
    priority: number;
    created_at: string;
  }>;
}

export const useChief = () => {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<ChiefSummaryResponse | null>(null);
  const { toast } = useToast();

  const getChiefSummary = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🤖 Fetching Chief summary...');

      const { data, error } = await supabase.functions.invoke('chief-summary');

      if (error) {
        throw error;
      }

      setSummaryData(data);
      console.log('✅ Chief summary fetched successfully');
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching Chief summary:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch Chief summary',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const markUpdatesAsRead = useCallback(async (updateIds: string[]) => {
    try {
      console.log('📖 Marking updates as read...');

      const { error } = await supabase
        .from('processed_updates')
        .update({ is_read: true })
        .in('id', updateIds);

      if (error) {
        throw error;
      }

      console.log('✅ Updates marked as read');
      
      // Refresh summary after marking as read
      await getChiefSummary();
    } catch (error) {
      console.error('❌ Error marking updates as read:', error);
      toast({
        title: "Error",
        description: 'Failed to mark updates as read',
        variant: "destructive",
      });
    }
  }, [getChiefSummary, toast]);

  const setupChiefCron = useCallback(async () => {
    try {
      setLoading(true);
      console.log('⚙️ Setting up Chief cron job...');

      const { data, error } = await supabase.functions.invoke('setup-chief-cron');

      if (error) {
        throw error;
      }

      console.log('✅ Chief cron job setup completed');
      toast({
        title: "Success",
        description: "Chief cron job has been set up to run every 5 minutes",
      });
      
      return data;
    } catch (error) {
      console.error('❌ Error setting up Chief cron job:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to setup cron job',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const triggerDataCollection = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Triggering Chief data collection...');

      const { data, error } = await supabase.functions.invoke('chief-data-collector');

      if (error) {
        throw error;
      }

      console.log('✅ Data collection completed:', data);
      toast({
        title: "Success",
        description: `Processed ${data.updates_processed} updates in ${data.processing_time_ms}ms`,
      });
      
      // Refresh summary after collection
      await getChiefSummary();
      
      return data;
    } catch (error) {
      console.error('❌ Error triggering data collection:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to collect data',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getChiefSummary, toast]);

  return {
    loading,
    summaryData,
    getChiefSummary,
    markUpdatesAsRead,
    setupChiefCron,
    triggerDataCollection
  };
};
