
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";

export interface IntegrationData {
  source: 'gmail' | 'calendar' | 'slack';
  data: any;
  lastFetched: string;
}

export const useIntegrationData = () => {
  const { user } = useAuth();
  const { isConnected } = useIntegrations();
  const [integrationData, setIntegrationData] = useState<IntegrationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGmailData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-gmail-emails');
      if (error) throw error;
      
      return {
        source: 'gmail' as const,
        data: data?.emails || [],
        lastFetched: new Date().toISOString()
      };
    } catch (err) {
      console.error('Error fetching Gmail data:', err);
      return null;
    }
  };

  const fetchCalendarData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-calendar-events');
      if (error) throw error;
      
      return {
        source: 'calendar' as const,
        data: data?.events || [],
        lastFetched: new Date().toISOString()
      };
    } catch (err) {
      console.error('Error fetching Calendar data:', err);
      return null;
    }
  };

  const fetchSlackData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-slack-messages');
      if (error) throw error;
      
      return {
        source: 'slack' as const,
        data: data || {},
        lastFetched: new Date().toISOString()
      };
    } catch (err) {
      console.error('Error fetching Slack data:', err);
      return null;
    }
  };

  const fetchAllIntegrationData = async () => {
    if (!user?.id) {
      setIntegrationData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const promises = [];
      
      if (isConnected('gmail')) {
        promises.push(fetchGmailData());
      }
      
      if (isConnected('calendar')) {
        promises.push(fetchCalendarData());
      }
      
      if (isConnected('slack')) {
        promises.push(fetchSlackData());
      }

      const results = await Promise.all(promises);
      const validResults = results.filter(result => result !== null) as IntegrationData[];
      
      setIntegrationData(validResults);
    } catch (err) {
      console.error("Error fetching integration data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllIntegrationData();
  }, [user?.id, isConnected('gmail'), isConnected('calendar'), isConnected('slack')]);

  return {
    integrationData,
    loading,
    error,
    refetch: fetchAllIntegrationData
  };
};
