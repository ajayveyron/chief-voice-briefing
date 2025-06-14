
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
      // First, try to get processed updates (real data)
      const { data: processedData, error: processedError } = await supabase
        .from("processed_updates")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (processedError) throw processedError;

      if (processedData && processedData.length > 0) {
        console.log(`📦 Found ${processedData.length} real processed updates`);
        setUpdates(processedData);
      } else {
        // If no processed updates, sync real data from integrations
        console.log("🔄 No processed updates found, syncing real data...");
        await syncRealData();
        
        // Wait a moment for processing, then fetch again
        setTimeout(async () => {
          const { data: newData, error: newError } = await supabase
            .from("processed_updates")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_read", false)
            .order("priority", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(10);
            
          if (!newError && newData) {
            console.log(`📦 Found ${newData.length} updates after sync`);
            setUpdates(newData);
          }
        }, 2000);
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
        .from("processed_updates")
        .update({ is_read: true })
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
