
-- Create a table to store processed updates from various sources
CREATE TABLE IF NOT EXISTS public.processed_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'gmail', 'calendar', 'slack'
  source_id TEXT NOT NULL, -- original ID from the source (email ID, event ID, message ID)
  content JSONB NOT NULL, -- raw data from the source
  summary TEXT, -- AI-generated summary
  action_suggestions TEXT[], -- array of suggested actions
  priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_processed_updates_user_created ON public.processed_updates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_updates_source_id ON public.processed_updates(user_id, source, source_id);
CREATE INDEX IF NOT EXISTS idx_processed_updates_unread ON public.processed_updates(user_id, is_read) WHERE is_read = false;

-- Add Row Level Security (RLS)
ALTER TABLE public.processed_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own processed updates" 
  ON public.processed_updates 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own processed updates" 
  ON public.processed_updates 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own processed updates" 
  ON public.processed_updates 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed updates" 
  ON public.processed_updates 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create a table for daily summaries
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  summary_date DATE NOT NULL,
  email_count INTEGER DEFAULT 0,
  calendar_count INTEGER DEFAULT 0,
  slack_count INTEGER DEFAULT 0,
  summary_text TEXT NOT NULL,
  action_items TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, summary_date)
);

-- Add RLS for daily summaries
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily summaries" 
  ON public.daily_summaries 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily summaries" 
  ON public.daily_summaries 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily summaries" 
  ON public.daily_summaries 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
