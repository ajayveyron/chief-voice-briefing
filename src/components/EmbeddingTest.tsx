
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { pipeline } from '@huggingface/transformers';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const EmbeddingTest: React.FC = () => {
  const [title, setTitle] = useState('First post!');
  const [body, setBody] = useState('Hello world!');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const generateAndStoreEmbedding = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔄 Initializing embedding pipeline...');
      
      // Generate embedding using Hugging Face transformers
      const generateEmbedding = await pipeline('feature-extraction', 'Supabase/gte-small');
      
      console.log('🔄 Generating embedding for text...');
      
      // Generate a vector using Transformers.js
      const output = await generateEmbedding(body, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract the embedding output
      const embedding = Array.from(output.data);
      
      console.log('✅ Embedding generated:', embedding.length, 'dimensions');

      // Store the vector in Postgres
      const { data, error: insertError } = await supabase.from('posts').insert({
        title,
        body,
        embedding,
      });

      if (insertError) {
        throw insertError;
      }

      console.log('✅ Post stored successfully');
      setResult({
        title,
        body,
        embeddingDimensions: embedding.length,
        data
      });

    } catch (err: any) {
      console.error('❌ Error generating embedding:', err);
      setError(err.message || 'Failed to generate embedding');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧠 Embedding Generation Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter post title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Body</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter post content"
            rows={4}
          />
        </div>

        <Button 
          onClick={generateAndStoreEmbedding}
          disabled={isLoading || !title.trim() || !body.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Embedding...
            </>
          ) : (
            'Generate Embedding & Store Post'
          )}
        </Button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Success!</span>
            </div>
            <div className="text-sm text-green-600">
              <p><strong>Title:</strong> {result.title}</p>
              <p><strong>Body:</strong> {result.body}</p>
              <p><strong>Embedding Dimensions:</strong> {result.embeddingDimensions}</p>
              <p className="text-xs mt-2 opacity-75">Post stored in database successfully</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmbeddingTest;
