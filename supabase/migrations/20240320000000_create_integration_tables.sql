-- Create table for tracking integration fetch times
create table if not exists integration_fetch_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  last_fetch_time timestamptz not null,
  created_at timestamptz default now()
);

-- Create index for faster lookups
create index if not exists idx_integration_fetch_logs_user_id on integration_fetch_logs(user_id);

-- Create table for storing processed integration data
create table if not exists processed_integration_data (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  source text not null check (source in ('gmail', 'calendar', 'slack')),
  raw_data jsonb not null,
  processed_data jsonb not null,
  is_viewed boolean default false,
  created_at timestamptz default now()
);

-- Create indexes for faster lookups
create index if not exists idx_processed_integration_data_user_id on processed_integration_data(user_id);
create index if not exists idx_processed_integration_data_source on processed_integration_data(source);
create index if not exists idx_processed_integration_data_is_viewed on processed_integration_data(is_viewed);

-- Add RLS policies
alter table integration_fetch_logs enable row level security;
alter table processed_integration_data enable row level security;

-- Policy for integration_fetch_logs
create policy "Users can view their own fetch logs"
  on integration_fetch_logs for select
  using (auth.uid() = user_id);

-- Policy for processed_integration_data
create policy "Users can view their own processed data"
  on processed_integration_data for select
  using (auth.uid() = user_id);

create policy "Users can update their own processed data"
  on processed_integration_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id); 