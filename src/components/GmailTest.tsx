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
  Users,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  generateAndStoreEmbedding,
  formatGmailForEmbedding,
} from "@/utils/embeddingUtils";
import { useAuth } from "@/hooks/useAuth";

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
}

interface GmailResponse {
  sent_emails: Email[];
  received_emails: Email[];
  error?: string;
}

interface Contact {
  name: string;
  email: string;
  role?: string;
  company?: string;
  context?: string;
  frequency: number;
}

interface UserPreferences {
  writing_style: string;
  tone: string;
  length_preference: string;
  formality_level: string;
  communication_patterns: string[];
  common_topics: string[];
}

interface AnalysisResult {
  preferences: UserPreferences;
  contacts: Contact[];
}

export const GmailTest = () => {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const { toast } = useToast();
  const { user } = useAuth();

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

      // Combine sent and received emails
      const allEmails = [...(data.sent_emails || []), ...(data.received_emails || [])];
      setEmails(allEmails);

      toast({
        title: "Gmail Connection Successful",
        description: `Fetched ${data.sent_emails?.length || 0} sent and ${data.received_emails?.length || 0} received emails.`,
      });

      // Automatically analyze emails first, then embed
      if (allEmails.length > 0 && user?.id) {
        try {
          // First: Analyze emails for preferences and contacts
          await callAnalyzeGmail(data.sent_emails || [], data.received_emails || []);

          // Then: Embed emails into vector store
          for (const email of allEmails) {
            await fetch(
              "https://xxccvppbxnhowncdhvdi.functions.supabase.co/generate-embeddings",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${sessionData.session.access_token}`,
                },
                body: JSON.stringify({
                  user_id: user.id,
                  source_type: "gmail",
                  source_id: email.id,
                  content: `From: ${email.from}\nSubject: ${
                    email.subject || "No Subject"
                  }\n\n${email.snippet || email.body || ""}`,
                  metadata: {
                    subject: email.subject,
                    from: email.from,
                    date: email.date,
                    snippet: email.snippet,
                  },
                }),
              }
            );
          }
          toast({
            title: "Emails Embedded Successfully",
            description: `${allEmails.length} emails have been embedded into the vector store.`,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          console.error("Processing error:", error);
          toast({
            title: "Processing Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
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

  // Call the analyze-gmail function
  const callAnalyzeGmail = async (sentEmails: Email[], receivedEmails: Email[]) => {
    if (sentEmails.length === 0 && receivedEmails.length === 0) return;

    setAnalysisLoading(true);
    try {

      // Prepare data for analysis
      const analysisData = {
        sent_emails: sentEmails.map((email) => ({
          subject: email.subject,
          snippet: email.snippet,
          body: email.body,
          date: email.date,
        })),
        received_emails: receivedEmails.map((email) => ({
          from: email.from,
          subject: email.subject,
          snippet: email.snippet,
          body: email.body,
          date: email.date,
        })),
      };

      // Call the analyze-gmail function
      const { data, error } = await supabase.functions.invoke("analyze-gmail", {
        body: {
          emails: analysisData,
          user_id: user?.id,
        },
      });

      if (error) throw error;

      setAnalysisResult(data);
      toast({
        title: "Analysis Complete",
        description: `Extracted ${data.contacts.length} contacts and user preferences from ${sentEmails.length + receivedEmails.length} emails.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const embedEmails = async () => {
    if (emails.length === 0) {
      toast({
        title: "No Data to Embed",
        description: "Please fetch emails first before embedding.",
        variant: "destructive",
      });
      return;
    }

    setEmbeddingLoading(true);
    try {
      const embeddingData = formatGmailForEmbedding(emails);

      for (const data of embeddingData) {
        await generateAndStoreEmbedding(data);
      }

      toast({
        title: "Emails Embedded Successfully",
        description: `${emails.length} emails have been embedded into the vector store.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Embedding error:", error);
      toast({
        title: "Embedding Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setEmbeddingLoading(false);
    }
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

        <div className="flex gap-2">
          <Button
            onClick={testGmailConnection}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 transition-colors"
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

          {/* Removed Embed Data button for this workflow */}
        </div>

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

        {/* Analysis Results */}
        {analysisLoading && (
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded">
            <div className="flex items-center gap-2 text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing emails for preferences and contacts...</span>
            </div>
          </div>
        )}

        {analysisResult && (
          <div className="mt-4 space-y-4">
            {/* User Preferences */}
            <Card className="bg-gray-700/50 border-gray-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-100 text-sm">
                  <Settings className="h-4 w-4 text-blue-500" />
                  <span>User Preferences</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400">Writing Style:</span>
                    <p className="text-gray-200">
                      {analysisResult.preferences.writing_style}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Tone:</span>
                    <p className="text-gray-200">
                      {analysisResult.preferences.tone}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Length Preference:</span>
                    <p className="text-gray-200">
                      {analysisResult.preferences.length_preference}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Formality Level:</span>
                    <p className="text-gray-200">
                      {analysisResult.preferences.formality_level}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 text-xs">
                    Communication Patterns:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {analysisResult.preferences.communication_patterns.map(
                      (pattern, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-600 rounded text-xs text-gray-200"
                        >
                          {pattern}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 text-xs">Common Topics:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {analysisResult.preferences.common_topics.map(
                      (topic, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-green-600/20 border border-green-600 rounded text-xs text-green-300"
                        >
                          {topic}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card className="bg-gray-700/50 border-gray-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-100 text-sm">
                  <Users className="h-4 w-4 text-green-500" />
                  <span>Contacts ({analysisResult.contacts.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {analysisResult.contacts.map((contact, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-800/50 rounded border border-gray-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h5 className="font-medium text-sm text-gray-100">
                            {contact.name}
                          </h5>
                          <p className="text-xs text-gray-400">
                            {contact.email}
                          </p>
                          {contact.role && (
                            <p className="text-xs text-blue-400">
                              Role: {contact.role}
                            </p>
                          )}
                          {contact.company && (
                            <p className="text-xs text-purple-400">
                              Company: {contact.company}
                            </p>
                          )}
                          {contact.context && (
                            <p className="text-xs text-gray-300 mt-1">
                              {contact.context}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {contact.frequency} email
                          {contact.frequency !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
