
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Update = Database["public"]["Tables"]["updates"]["Row"];

export const useUpdates = () => {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from("updates")
        .select("*")
        .eq("is_read", false)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      console.error("Error fetching updates:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (updateId: string) => {
    try {
      const { error } = await supabase
        .from("updates")
        .update({ is_read: true })
        .eq("id", updateId);

      if (error) throw error;
      
      // Update local state
      setUpdates(prev => prev.filter(update => update.id !== updateId));
    } catch (error) {
      console.error("Error marking update as read:", error);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  return { updates, loading, fetchUpdates, markAsRead };
};
