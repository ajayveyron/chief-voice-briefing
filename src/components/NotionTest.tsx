
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Database, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { embedData } from '../utils/embeddingUtils';

interface NotionPage {
  id: string;
  title: string;
  content: string;
  last_edited: string;
  url?: string;
}

const NotionTest = () => {
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-notion', {
        body: { action: 'fetch' }
      });

      if (error) throw error;
      setPages(data.pages || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Notion pages');
    } finally {
      setLoading(false);
    }
  };

  const handleEmbedData = async () => {
    if (pages.length === 0) {
      setError('No pages to embed. Please fetch pages first.');
      return;
    }

    setEmbedLoading(true);
    setError(null);

    try {
      await embedData(pages, 'notion');
      // Show success message or update UI
    } catch (err: any) {
      setError(err.message || 'Failed to embed data');
    } finally {
      setEmbedLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Button 
          onClick={fetchPages} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {loading ? 'Fetching...' : 'Fetch Pages'}
        </Button>

        <Button
          onClick={handleEmbedData}
          disabled={embedLoading || pages.length === 0}
          variant="outline"
          className="flex items-center gap-2"
        >
          {embedLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          {embedLoading ? 'Embedding...' : 'Embed Data'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {pages.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Recent Pages</h3>
                <Badge variant="secondary">{pages.length} pages</Badge>
              </div>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-4">
                {pages.map((page, index) => (
                  <div key={page.id}>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{page.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>Last edited: {formatDate(page.last_edited)}</span>
                          </div>
                        </div>
                        <Badge variant="outline">Page</Badge>
                      </div>
                      
                      {page.content && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {page.content}
                        </p>
                      )}
                    </div>
                    {index < pages.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!loading && pages.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No pages loaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Fetch Pages" to load your Notion pages
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotionTest;
