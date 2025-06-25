
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Database, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { embedData } from '../utils/embeddingUtils';

interface Email {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

const GmailTest = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-gmail', {
        body: { action: 'fetch' }
      });

      if (error) throw error;
      setEmails(data.emails || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  const handleEmbedData = async () => {
    if (emails.length === 0) {
      setError('No emails to embed. Please fetch emails first.');
      return;
    }

    setEmbedLoading(true);
    setError(null);

    try {
      await embedData(emails, 'gmail');
      // Show success message or update UI
    } catch (err: any) {
      setError(err.message || 'Failed to embed data');
    } finally {
      setEmbedLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Button 
          onClick={fetchEmails} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {loading ? 'Fetching...' : 'Fetch Emails'}
        </Button>

        <Button
          onClick={handleEmbedData}
          disabled={embedLoading || emails.length === 0}
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

      {emails.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Recent Emails</h3>
                <Badge variant="secondary">{emails.length} emails</Badge>
              </div>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-4">
                {emails.map((email, index) => (
                  <div key={email.id}>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{email.subject}</h4>
                          <p className="text-sm text-muted-foreground">{email.from}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {new Date(email.date).toLocaleDateString()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {email.snippet}
                      </p>
                    </div>
                    {index < emails.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!loading && emails.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No emails loaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Fetch Emails" to load your recent emails
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GmailTest;
