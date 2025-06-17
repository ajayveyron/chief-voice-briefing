
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Clock, User } from "lucide-react";

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
}

interface GmailResponse {
  emails: Email[];
}

export const GmailTest = () => {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const { toast } = useToast();

  const testGmailConnection = async () => {
    setLoading(true);
    setEmails([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('fetch-gmail-emails', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) throw error;

      const response = data as GmailResponse;
      setEmails(response.emails || []);
      
      toast({
        title: "Success",
        description: `Fetched ${response.emails?.length || 0} emails from Gmail.`,
      });
    } catch (error) {
      console.error('Gmail test error:', error);
      toast({
        title: "Error",
        description: `Gmail test failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const extractSenderName = (from: string) => {
    const match = from.match(/^(.+?)\s*<.+>$/);
    return match ? match[1].trim() : from;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-red-500" />
          <span>Gmail Test</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Gmail integration by fetching recent unread emails from your inbox.
        </p>
        
        <Button
          onClick={testGmailConnection}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching Emails...
            </>
          ) : (
            "Test Gmail Connection"
          )}
        </Button>

        {emails.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-sm">Recent Unread Emails ({emails.length})</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {emails.map((email) => (
                <Card key={email.id} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-medium text-sm line-clamp-2 text-white">
                          {email.subject || "No Subject"}
                        </h5>
                        <div className="flex items-center text-xs text-gray-400 whitespace-nowrap">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(email.date)}
                        </div>
                      </div>
                      
                      <div className="flex items-center text-xs text-gray-300">
                        <User className="h-3 w-3 mr-1" />
                        <span className="truncate">{extractSenderName(email.from)}</span>
                      </div>
                      
                      {email.snippet && (
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {email.snippet}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {emails.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No emails to display. Click "Test Gmail Connection" to fetch your recent emails.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
