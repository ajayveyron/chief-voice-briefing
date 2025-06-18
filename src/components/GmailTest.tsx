import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  Loader2,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  error?: string;
}

export const GmailTest = () => {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const { toast } = useToast();

  const testGmailConnection = async () => {
    setLoading(true);
    setEmails([]);
    setExpandedEmail(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || "No active session");
      }

      const { data, error } = await supabase.functions.invoke<GmailResponse>(
        "fetch-gmail-emails",
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setEmails(data.emails || []);

      toast({
        title: "Gmail Connection Successful",
        description: `Fetched ${
          data.emails?.length || 0
        } emails from your inbox.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Gmail test error:", error);
      toast({
        title: "Gmail Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  const extractSenderInfo = (from: string) => {
    const match = from.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+?)>?)$/);
    return {
      name: match?.[1]?.trim() || match?.[2] || from,
      email: match?.[2] || from,
    };
  };

  const toggleExpandEmail = (id: string) => {
    setExpandedEmail(expandedEmail === id ? null : id);
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Mail className="h-5 w-5 text-red-500" />
          <span>Gmail Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Gmail integration by fetching recent unread emails from your
          inbox.
        </p>

        <Button
          onClick={testGmailConnection}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 transition-colors"
          aria-label="Test Gmail connection"
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
          <div className="mt-4 space-y-3">
            <h4 className="font-medium text-sm text-gray-300">
              Recent Unread Emails ({emails.length})
            </h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {emails.map((email) => {
                const sender = extractSenderInfo(email.from);
                return (
                  <Card
                    key={email.id}
                    className="bg-gray-700/50 border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-medium text-sm text-gray-100 line-clamp-2">
                            {email.subject || "No Subject"}
                          </h5>
                          <button
                            onClick={() => toggleExpandEmail(email.id)}
                            className="text-gray-400 hover:text-gray-300 transition-colors"
                            aria-label={
                              expandedEmail === email.id
                                ? "Collapse email"
                                : "Expand email"
                            }
                          >
                            {expandedEmail === email.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center text-xs text-gray-300">
                          <User className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate" title={sender.email}>
                            {sender.name}
                          </span>
                        </div>

                        <div className="flex items-center text-xs text-gray-400">
                          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{formatDate(email.date)}</span>
                        </div>

                        <p className="text-xs text-gray-400 line-clamp-2">
                          {email.snippet}
                        </p>

                        {expandedEmail === email.id && email.body && (
                          <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-300 overflow-auto max-h-60">
                            <div
                              dangerouslySetInnerHTML={{ __html: email.body }}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {emails.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No emails to display. Click "Test Gmail Connection" to fetch your
              recent emails.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
