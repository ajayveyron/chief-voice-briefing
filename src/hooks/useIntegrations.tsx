
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Integration = Database["public"]["Tables"]["user_integrations"]["Row"];
type IntegrationType = 'gmail' | 'calendar' | 'slack' | string;

export const useIntegrations = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!user?.id) {
      setIntegrations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (queryError) throw queryError;
      setIntegrations(data || []);
    } catch (err) {
      console.error("Error fetching integrations:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const connectIntegration = async (type: IntegrationType) => {
    try {
      setError(null);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        throw sessionError || new Error('User session not found');
      }

      const { data, error: functionError } = await supabase.functions.invoke(`${type}-auth`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (functionError) throw functionError;
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Authentication URL not received');
      }
    } catch (err) {
      console.error(`Error connecting ${type}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const disconnectIntegration = async (type: IntegrationType) => {
    if (!user?.id) return;

    try {
      setError(null);
      const { error: updateError } = await supabase
        .from("user_integrations")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("integration_type", type);

      if (updateError) throw updateError;
      
      // Optimistic update
      setIntegrations(prev => 
        prev.filter(integration => 
          !(integration.integration_type === type && integration.is_active)
        )
      );
      
      // Then refresh from server
      await fetchIntegrations();
    } catch (err) {
      console.error(`Error disconnecting ${type}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const isConnected = (type: IntegrationType) => {
    return integrations.some(
      integration => integration.integration_type === type && integration.is_active
    );
  };

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return {
    integrations,
    loading,
    error,
    connectIntegration,
    disconnectIntegration,
    isConnected,
    refetch: fetchIntegrations
  };
};
