
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Loader2, Hash, User, Clock } from "lucide-react";

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  username?: string;
  channel?: string;
  channel_name?: string;
  type?: string;
  subtype?: string;
}

interface SlackResponse {
  messages: SlackMessage[];
  workspace?: string;
}

export const SlackTest = () => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [workspace, setWorkspace] = useState<string>('');
  const { toast } = useToast();

  const testSlackConnection = async () => {
    setLoading(true);
    setMessages([]);
    setWorkspace('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('fetch-slack-messages', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) throw error;

      const response = data as SlackResponse;
      setMessages(response.messages || []);
      setWorkspace(response.workspace || '');
      
      toast({
        title: "Success",
        description: `Fetched ${response.messages?.length || 0} recent messages.`,
      });
    } catch (error) {
      console.error('Slack test error:', error);
      toast({
        title: "Error",
        description: `Slack test failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const timestamp = parseFloat(ts) * 1000;
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown time';
    }
  };

  const formatMessageText = (text: string) => {
    // Basic Slack markup cleanup
    return text
      .replace(/<@U[A-Z0-9]+>/g, '@user')
      .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, '#$1')
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
      .replace(/<([^>]+)>/g, '$1')
      .trim();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-green-500" />
          <span>Slack Test</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Slack integration by fetching recent messages from your workspace.
        </p>
        
        <Button
          onClick={testSlackConnection}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching Messages...
            </>
          ) : (
            "Test Slack Connection"
          )}
        </Button>

        {workspace && (
          <div className="text-xs text-gray-400 bg-gray-800/50 px-3 py-2 rounded">
            Connected to: <span className="text-green-400">{workspace}</span>
          </div>
        )}

        {messages.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-sm">Recent Messages ({messages.length})</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map((message, index) => (
                <Card key={`${message.ts}-${index}`} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center text-xs text-gray-300 gap-2">
                          {message.channel_name && (
                            <div className="flex items-center">
                              <Hash className="h-3 w-3 mr-1" />
                              <span className="font-medium">{message.channel_name}</span>
                            </div>
                          )}
                          {message.username && (
                            <div className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              <span>{message.username}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-gray-400 whitespace-nowrap">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimestamp(message.ts)}
                        </div>
                      </div>
                      
                      {message.text && (
                        <p className="text-sm text-gray-200 line-clamp-3">
                          {formatMessageText(message.text)}
                        </p>
                      )}
                      
                      {message.subtype && (
                        <span className="text-xs text-gray-500 italic">
                          {message.subtype}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages to display. Click "Test Slack Connection" to fetch recent messages.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
