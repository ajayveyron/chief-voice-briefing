
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserDocument {
  id: string;
  name: string;
  content: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export const useUserDocuments = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDocuments = async () => {
    if (!user?.id) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("user_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching user documents:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user?.id]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments
  };
};
