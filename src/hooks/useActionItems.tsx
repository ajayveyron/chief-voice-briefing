
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface CreateActionItemRequest {
  title: string;
  description?: string;
  priority?: number;
  due_date?: string;
  related_update_id?: string;
}

interface UpdateActionItemRequest {
  status?: string;
  priority?: number;
  due_date?: string;
  description?: string;
}

export const useActionItems = () => {
  const [loading, setLoading] = useState(false);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchActionItems = useCallback(async (status?: string) => {
    try {
      setLoading(true);
      console.log('📋 Fetching action items...');

      let query = supabase
        .from('action_items')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setActionItems(data || []);
      console.log('✅ Action items fetched successfully');
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching action items:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch action items',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createActionItem = useCallback(async (item: CreateActionItemRequest) => {
    try {
      setLoading(true);
      console.log('📝 Creating action item...');

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('action_items')
        .insert({
          user_id: user.id,
          title: item.title,
          description: item.description,
          priority: item.priority || 1,
          due_date: item.due_date,
          related_update_id: item.related_update_id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Action item created successfully');
      toast({
        title: "Success",
        description: "Action item created successfully",
      });
      
      // Refresh the list
      await fetchActionItems();
      
      return data;
    } catch (error) {
      console.error('❌ Error creating action item:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create action item',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchActionItems, toast]);

  const updateActionItem = useCallback(async (id: string, updates: UpdateActionItemRequest) => {
    try {
      setLoading(true);
      console.log('🔄 Updating action item...');

      const { data, error } = await supabase
        .from('action_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Action item updated successfully');
      toast({
        title: "Success",
        description: "Action item updated successfully",
      });
      
      // Refresh the list
      await fetchActionItems();
      
      return data;
    } catch (error) {
      console.error('❌ Error updating action item:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update action item',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchActionItems, toast]);

  const deleteActionItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      console.log('🗑️ Deleting action item...');

      const { error } = await supabase
        .from('action_items')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      console.log('✅ Action item deleted successfully');
      toast({
        title: "Success",
        description: "Action item deleted successfully",
      });
      
      // Refresh the list
      await fetchActionItems();
    } catch (error) {
      console.error('❌ Error deleting action item:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete action item',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchActionItems, toast]);

  const completeActionItem = useCallback(async (id: string) => {
    return updateActionItem(id, { status: 'completed' });
  }, [updateActionItem]);

  const dismissActionItem = useCallback(async (id: string) => {
    return updateActionItem(id, { status: 'dismissed' });
  }, [updateActionItem]);

  return {
    loading,
    actionItems,
    fetchActionItems,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    completeActionItem,
    dismissActionItem
  };
};
