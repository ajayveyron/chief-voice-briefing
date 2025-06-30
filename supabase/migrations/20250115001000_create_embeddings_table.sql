-- Create unified embeddings table for all sources (gmail, calendar, etc.)
CREATE TABLE embeddings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('gmail', 'calendar', 'slack', 'notion')),
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);

-- Indexes for similarity search and filtering
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON embeddings (user_id, source_type);
CREATE INDEX ON embeddings (created_at);

-- Enable Row Level Security
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own embeddings"
  ON embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own embeddings"
  ON embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own embeddings"
  ON embeddings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own embeddings"
  ON embeddings FOR DELETE
  USING (auth.uid() = user_id); 