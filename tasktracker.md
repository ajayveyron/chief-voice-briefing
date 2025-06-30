# Vector Store Integration Task Tracker

## Overview

Integrate Gmail and Calendar data with Supabase vector store for semantic search capabilities.

## Current State

- ✅ Gmail API integration exists with OAuth flow
- ✅ Calendar API integration exists with OAuth flow
- ✅ Supabase client is configured
- ✅ Existing data processing functions for both Gmail and Calendar
- ✅ Database tables for storing integration data
- ✅ Vector store integration (pgvector) enabled
- ✅ Embeddings generation via OpenAI Edge Function
- ✅ Incremental data fetching for Gmail (on test integration)

## Implementation Plan

### Phase 1: Vector Store Setup & Infrastructure

#### Task 1.1: Enable pgvector Extension

- [x] Create migration to enable pgvector extension in Supabase
- [x] Test extension availability

#### Task 1.2: Create Unified Embeddings Table

- [x] Create migration for unified `embeddings` table
- [x] Add proper indexes for similarity search
- [x] Set up RLS policies
- [x] Test table creation and permissions

#### Task 1.3: Set Up Embeddings Service

- [x] Create new Supabase Edge Function: `generate-embeddings`
- [x] Integrate with OpenAI's embedding API (text-embedding-3-small)
- [x] Handle text preprocessing and chunking
- [x] Test embedding generation

### Phase 2: Incremental Data Fetching

#### Task 2.1: Modify Gmail Processor

- [x] Update Gmail integration to trigger embedding on test integration (UI)
- [x] Embedding is triggered on test integration, not batch collector
- [ ] (Optional) Add deduplication using `(user_id, source_type, source_id)` if needed
- [ ] Test incremental fetching in other flows

#### Task 2.2: Modify Calendar Processor

- [ ] Update `calendar-processor.ts` to track last fetch time
- [ ] Implement incremental fetching logic (only new/updated events)
- [ ] Add deduplication using `(user_id, source_type, source_id)`
- [ ] Test incremental fetching

### Phase 3: Vector Store Integration

#### Task 3.1: Create Vector Store Processor

- [ ] Create new Edge Function: `vector-store-processor`
- [ ] Process incoming Gmail data and generate embeddings
- [ ] Process incoming Calendar data and generate embeddings
- [ ] Store embeddings in unified table
- [ ] Test end-to-end processing

#### Task 3.2: Implement Search Functionality

- [ ] Create `vector-search` Edge Function
- [ ] Support semantic search across all sources
- [ ] Return relevant results with similarity scores
- [ ] Add filtering by source, date range, etc.
- [ ] Test search functionality

### Phase 4: Integration & Testing

#### Task 4.1: Update Existing Functions

- [ ] Modify `chief-data-collector` to trigger vector processing
- [ ] Update `chief-ai-chat` to use vector search for context
- [ ] Ensure proper error handling and logging
- [ ] Test integration

#### Task 4.2: Testing & Validation

- [ ] Test incremental fetching with real data
- [ ] Validate embedding quality and search relevance
- [ ] Performance testing with large datasets
- [ ] End-to-end testing

### Phase 5: Future Extensibility

#### Task 5.1: Prepare for Slack & Notion

- [ ] Document schema for additional sources
- [ ] Create generic vector processing pipeline
- [ ] Plan for multi-source search capabilities

## Database Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Unified embeddings table
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

-- Indexes for similarity search
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON embeddings (user_id, source_type);
CREATE INDEX ON embeddings (created_at);

-- RLS policies
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

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
```

## Example Data Structure

### Gmail Entry

```json
{
  "user_id": "uuid",
  "source_type": "gmail",
  "source_id": "18c1234567890abc",
  "content": "Subject: Meeting Tomorrow\nFrom: john@example.com\n\nHi, let's meet tomorrow at 2pm...",
  "metadata": {
    "subject": "Meeting Tomorrow",
    "sender": "john@example.com",
    "timestamp": "2024-01-15T10:30:00Z",
    "labels": ["INBOX", "UNREAD"]
  }
}
```

### Calendar Entry

```json
{
  "user_id": "uuid",
  "source_type": "calendar",
  "source_id": "abc123def456",
  "content": "Team Standup\nDaily team meeting\nAttendees: john@example.com, jane@example.com",
  "metadata": {
    "summary": "Team Standup",
    "description": "Daily team meeting",
    "start_time": "2024-01-16T09:00:00Z",
    "end_time": "2024-01-16T09:30:00Z",
    "attendees": ["john@example.com", "jane@example.com"]
  }
}
```

## Key Technical Considerations

1. **Incremental Processing**: Use timestamps and message IDs to avoid duplicates
2. **Content Chunking**: Split large emails/events into manageable chunks for embeddings
3. **Rate Limiting**: Respect API limits for both Google APIs and OpenAI
4. **Error Handling**: Robust error handling for API failures and embedding generation
5. **Performance**: Optimize vector search with proper indexing
6. **Security**: Ensure RLS policies protect user data

## Next Steps

Start with Task 2.2: Automate Calendar event embeddings
