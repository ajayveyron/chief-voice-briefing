-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is available
SELECT * FROM pg_extension WHERE extname = 'vector'; 