
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MessageCircle, Database, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { embedData } from '../utils/embeddingUtils';

interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  text: string;
  timestamp: string;
}

const SlackTest = () => {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-slack', {
        body: { action: 'fetch' }
      });

      if (error) throw error;
      setMessages(data.messages || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Slack messages');
    } finally {
      setLoading(false);
    }
  };

  const handleEmbedData = async () => {
    if (messages.length === 0) {
      setError('No messages to embed. Please fetch messages first.');
      return;
    }

    setEmbedLoading(true);
    setError(null);

    try {
      await embedData(messages, 'slack');
      // Show success message or update UI
    } catch (err: any) {
      setError(err.message || 'Failed to embed data');
    } finally {
      setEmbedLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Button 
          onClick={fetchMessages} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          {loading ? 'Fetching...' : 'Fetch Messages'}
        </Button>

        <Button
          onClick={handleEmbedData}
          disabled={embedLoading || messages.length === 0}
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

      {messages.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Recent Messages</h3>
                <Badge variant="secondary">{messages.length} messages</Badge>
              </div>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-4">
                {messages.map((message, index) => (
                  <div key={message.id}>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{message.user}</span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Hash className="h-3 w-3" />
                              <span>{message.channel}</span>
                            </div>
                          </div>
                          <p className="text-sm mt-1">{message.text}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {formatTimestamp(message.timestamp)}
                        </Badge>
                      </div>
                    </div>
                    {index < messages.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!loading && messages.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No messages loaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Fetch Messages" to load your Slack messages
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SlackTest;
