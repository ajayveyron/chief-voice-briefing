
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ActionItem {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: string;
  due_date?: string;
  created_at: string;
}

interface ScheduledTask {
  id: string;
  task_type: string;
  title: string;
  description?: string;
  scheduled_for: string;
  is_completed: boolean;
  metadata: any;
}

export const useActionItems = () => {
  const [loading, setLoading] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const { toast } = useToast();

  const fetchActionItems = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📋 Fetching action items...');

      const { data, error } = await supabase
        .from('action_items')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setActionItems(data || []);
      console.log(`✅ Fetched ${data?.length || 0} action items`);
    } catch (error) {
      console.error('❌ Error fetching action items:', error);
      toast({
        title: "Error",
        description: 'Failed to fetch action items',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchScheduledTasks = useCallback(async () => {
    try {
      setLoading(true);
      console.log('⏰ Fetching scheduled tasks...');

      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('is_completed', false)
        .order('scheduled_for', { ascending: true });

      if (error) {
        throw error;
      }

      setScheduledTasks(data || []);
      console.log(`✅ Fetched ${data?.length || 0} scheduled tasks`);
    } catch (error) {
      console.error('❌ Error fetching scheduled tasks:', error);
      toast({
        title: "Error",
        description: 'Failed to fetch scheduled tasks',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateActionItemStatus = useCallback(async (id: string, status: string) => {
    try {
      console.log(`📝 Updating action item status: ${id} -> ${status}`);

      const { error } = await supabase
        .from('action_items')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Update local state
      setActionItems(prev => 
        prev.map(item => 
          item.id === id ? { ...item, status } : item
        )
      );

      toast({
        title: "Success",
        description: `Action item marked as ${status}`,
      });

      console.log('✅ Action item status updated');
    } catch (error) {
      console.error('❌ Error updating action item:', error);
      toast({
        title: "Error",
        description: 'Failed to update action item',
        variant: "destructive",
      });
    }
  }, [toast]);

  const createActionItem = useCallback(async (
    title: string, 
    description?: string, 
    priority = 1, 
    dueDate?: string
  ) => {
    try {
      console.log('📝 Creating new action item...');

      const { data, error } = await supabase
        .from('action_items')
        .insert({
          title,
          description,
          priority,
          due_date: dueDate,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setActionItems(prev => [data, ...prev]);
      
      toast({
        title: "Success",
        description: "Action item created successfully",
      });

      console.log('✅ Action item created');
      return data;
    } catch (error) {
      console.error('❌ Error creating action item:', error);
      toast({
        title: "Error",
        description: 'Failed to create action item',
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  return {
    loading,
    actionItems,
    scheduledTasks,
    fetchActionItems,
    fetchScheduledTasks,
    updateActionItemStatus,
    createActionItem
  };
};
