// Hook for action execution and confirmation in React components
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ActionPayload {
  [key: string]: any;
}

export interface PendingAction {
  id: string;
  type: string;
  payload: ActionPayload;
  confirmation_prompt: string;
  action_details: any;
}

export const useActionExecution = () => {
  const { user } = useAuth();
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());

  const executeAction = useCallback(async (
    actionType: string,
    payload: ActionPayload,
    suggestionId?: string,
    requiresConfirmation: boolean = true
  ) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return null;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Authentication session not found");
        return null;
      }

      console.log(`🎯 Executing action: ${actionType}`);

      const { data, error } = await supabase.functions.invoke('chief-action-executor', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          suggestion_id: suggestionId,
          action_type: actionType,
          payload,
          user_id: user.id,
          requires_confirmation: requiresConfirmation,
          confirmed: !requiresConfirmation
        }
      });

      if (error) {
        console.error("Error executing action:", error);
        toast.error(`Failed to execute action: ${error.message}`);
        return null;
      }

      if (data.status === 'pending_confirmation') {
        // Add to pending actions for user confirmation
        const pendingAction: PendingAction = {
          id: data.action_id,
          type: actionType,
          payload,
          confirmation_prompt: data.confirmation_prompt,
          action_details: data.action_details
        };
        
        setPendingActions(prev => [...prev, pendingAction]);
        toast.info("Action requires confirmation");
        return data;
      } else if (data.status === 'executed') {
        toast.success(data.message);
        return data;
      } else if (data.status === 'failed') {
        toast.error(data.message);
        return data;
      }

      return data;
    } catch (error) {
      console.error("Error in executeAction:", error);
      toast.error("Failed to execute action");
      return null;
    }
  }, [user?.id]);

  const confirmAction = useCallback(async (actionId: string, confirmed: boolean) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      setExecutingActions(prev => new Set(prev).add(actionId));

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Authentication session not found");
        return false;
      }

      const { data, error } = await supabase.functions.invoke('chief-action-confirmer', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          action_id: actionId,
          user_id: user.id,
          confirmed
        }
      });

      if (error) {
        console.error("Error confirming action:", error);
        toast.error(`Failed to confirm action: ${error.message}`);
        return false;
      }

      // Remove from pending actions
      setPendingActions(prev => prev.filter(action => action.id !== actionId));
      
      if (confirmed && data.status === 'executed') {
        toast.success("Action confirmed and executed successfully");
      } else if (!confirmed && data.status === 'cancelled') {
        toast.info("Action cancelled");
      }

      return true;
    } catch (error) {
      console.error("Error in confirmAction:", error);
      toast.error("Failed to confirm action");
      return false;
    } finally {
      setExecutingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  }, [user?.id]);

  const retryAction = useCallback(async (actionId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      // Get the action details first
      const { data: actionData, error: fetchError } = await supabase
        .from('actions')
        .select('*')
        .eq('id', actionId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !actionData) {
        toast.error("Action not found");
        return false;
      }

      // Re-execute the action
      return await executeAction(
        actionData.type,
        typeof actionData.payload === 'string' ? JSON.parse(actionData.payload) : actionData.payload as ActionPayload,
        actionData.suggestion_id,
        false // Skip confirmation for retry
      );
    } catch (error) {
      console.error("Error in retryAction:", error);
      toast.error("Failed to retry action");
      return false;
    }
  }, [user?.id, executeAction]);

  const clearPendingAction = useCallback((actionId: string) => {
    setPendingActions(prev => prev.filter(action => action.id !== actionId));
  }, []);

  return {
    executeAction,
    confirmAction,
    retryAction,
    pendingActions,
    executingActions,
    clearPendingAction
  };
};