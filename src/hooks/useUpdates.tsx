
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Update = Database["public"]["Tables"]["processed_updates"]["Row"];

export const useUpdates = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  const syncRealData = async () => {
    if (!user?.id) return;

    try {
      console.log("🔄 Syncing real data from integrations...");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      // Trigger data collection from all active integrations
      const { data, error } = await supabase.functions.invoke('chief-data-collector', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) {
        console.error("Error syncing real data:", error);
      } else {
        console.log("✅ Real data synced successfully");
      }
    } catch (error) {
      console.error("Error syncing real data:", error);
    }
  };

  const fetchUpdates = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get summaries with their suggestions using the new schema
      const { data: summariesData, error: summariesError } = await supabase
        .from("summaries")
        .select(`
          *,
          llm_suggestions(*)
        `)
        .eq("user_id", user.id)
        .eq("is_viewed", false)
        .order("importance", { ascending: false })
        .order("processed_at", { ascending: false })
        .limit(10);

      if (summariesError) throw summariesError;

      if (summariesData && summariesData.length > 0) {
        console.log(`📦 Found ${summariesData.length} summaries with suggestions`);
        // Transform to match the expected Update interface
        const transformedUpdates = summariesData.map(summary => ({
          id: summary.id,
          user_id: summary.user_id,
          source: summary.raw_event_id ? 'processed' : 'unknown',
          source_id: summary.id,
          content: { summary: summary.summary, topic: summary.topic },
          summary: summary.summary,
          action_suggestions: summary.llm_suggestions?.map(s => s.prompt) || [],
          priority: summary.importance === 'high' ? 3 : summary.importance === 'medium' ? 2 : 1,
          is_read: summary.is_viewed,
          created_at: summary.processed_at,
          updated_at: summary.processed_at,
          processed_at: summary.processed_at
        }));
        setUpdates(transformedUpdates);
      } else {
        // If no summaries, sync real data from integrations
        console.log("🔄 No summaries found, syncing real data...");
        await syncRealData();
        
        // Wait a moment for processing, then fetch again
        setTimeout(async () => {
          const { data: newData, error: newError } = await supabase
            .from("summaries")
            .select(`
              *,
              llm_suggestions(*)
            `)
            .eq("user_id", user.id)
            .eq("is_viewed", false)
            .order("importance", { ascending: false })
            .order("processed_at", { ascending: false })
            .limit(10);
            
          if (!newError && newData) {
            console.log(`📦 Found ${newData.length} summaries after sync`);
            const transformedUpdates = newData.map(summary => ({
              id: summary.id,
              user_id: summary.user_id,
              source: 'processed',
              source_id: summary.id,
              content: { summary: summary.summary, topic: summary.topic },
              summary: summary.summary,
              action_suggestions: summary.llm_suggestions?.map(s => s.prompt) || [],
              priority: summary.importance === 'high' ? 3 : summary.importance === 'medium' ? 2 : 1,
              is_read: summary.is_viewed,
              created_at: summary.processed_at,
              updated_at: summary.processed_at,
              processed_at: summary.processed_at
            }));
            setUpdates(transformedUpdates);
          }
        }, 3000); // Increased timeout for processing pipeline
      }
    } catch (error) {
      console.error("Error fetching updates:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (updateId: string) => {
    try {
      const { error } = await supabase
        .from("summaries")
        .update({ is_viewed: true })
        .eq("id", updateId);

      if (error) throw error;
      
      // Update local state
      setUpdates(prev => prev.filter(update => update.id !== updateId));
    } catch (error) {
      console.error("Error marking update as read:", error);
    }
  };

  const triggerDataSync = async () => {
    setLoading(true);
    await syncRealData();
    setTimeout(() => fetchUpdates(), 2000);
  };

  useEffect(() => {
    fetchUpdates();
  }, [user?.id]);

  return { updates, loading, fetchUpdates, markAsRead, triggerDataSync };
};
