
-- Add conversation history table for long-term context awareness
CREATE TABLE IF NOT EXISTS public.conversation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_created ON public.conversation_history(user_id, created_at DESC);

-- Add RLS for conversation history
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation history" 
  ON public.conversation_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversation history" 
  ON public.conversation_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Add scheduled tasks table for reminders and proactive notifications
CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  task_type VARCHAR(50) NOT NULL, -- 'reminder', 'follow_up', 'notification'
  title TEXT NOT NULL,
  description TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for scheduled tasks
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_scheduled ON public.scheduled_tasks(user_id, scheduled_for) WHERE is_completed = false;

-- Add RLS for scheduled tasks
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scheduled tasks" 
  ON public.scheduled_tasks 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Add action items table to track suggested actions
CREATE TABLE IF NOT EXISTS public.action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  related_update_id UUID REFERENCES public.processed_updates(id),
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=urgent
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'dismissed'
  due_date TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for action items
CREATE INDEX IF NOT EXISTS idx_action_items_user_status ON public.action_items(user_id, status, priority DESC);

-- Add RLS for action items
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own action items" 
  ON public.action_items 
  FOR ALL 
  USING (auth.uid() = user_id);
