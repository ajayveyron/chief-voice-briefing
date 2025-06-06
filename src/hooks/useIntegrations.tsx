
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Integration = Database["public"]["Tables"]["user_integrations"]["Row"];

export const useIntegrations = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const connectIntegration = async (type: 'gmail' | 'calendar') => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw sessionError || new Error('User session not found');
      }

      const { data, error } = await supabase.functions.invoke(`${type}-auth`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) throw error;
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error(`Error connecting ${type}:`, error);
      throw error;
    }
  };

  const disconnectIntegration = async (type: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_integrations")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("integration_type", type);

      if (error) throw error;
      await fetchIntegrations();
    } catch (error) {
      console.error(`Error disconnecting ${type}:`, error);
      throw error;
    }
  };

  const isConnected = (type: string) => {
    return integrations.some(integration => 
      integration.integration_type === type && integration.is_active
    );
  };

  useEffect(() => {
    fetchIntegrations();
  }, [user]);

  return {
    integrations,
    loading,
    connectIntegration,
    disconnectIntegration,
    isConnected,
    refetch: fetchIntegrations
  };
};
