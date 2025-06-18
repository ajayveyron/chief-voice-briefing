import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  Loader2,
  Hash,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  username?: string;
  channel?: string;
  channel_name?: string;
  type?: string;
  subtype?: string;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
  attachments?: Array<{
    title?: string;
    text?: string;
    image_url?: string;
    thumb_url?: string;
  }>;
}

interface SlackResponse {
  messages: SlackMessage[];
  workspace?: string;
  error?: string;
}

export const SlackTest = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SlackResponse | null>(null);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const testSlackConnection = async () => {
    setLoading(true);
    setData(null);
    setExpandedMessage(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || "No active session");
      }

      const { data, error } = await supabase.functions.invoke<SlackResponse>(
        "fetch-slack-messages",
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setData(data);

      toast({
        title: "Slack Connection Successful",
        description: `Fetched ${data.messages?.length || 0} recent messages.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Slack test error:", error);
      toast({
        title: "Slack Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const timestamp = parseFloat(ts) * 1000;
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Unknown time";
    }
  };

  const formatMessageText = (text: string) => {
    if (!text) return "";
    return text
      .replace(/<@U[A-Z0-9]+>/g, "@user")
      .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, "#$1")
      .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
      .replace(/<([^>]+)>/g, "$1")
      .trim();
  };

  const toggleExpandMessage = (ts: string) => {
    setExpandedMessage(expandedMessage === ts ? null : ts);
  };

  const getMessageTypeInfo = (type?: string, subtype?: string) => {
    if (subtype === "bot_message")
      return { text: "Bot Message", color: "text-purple-400 bg-purple-400/10" };
    if (subtype === "channel_join")
      return { text: "User Joined", color: "text-green-400 bg-green-400/10" };
    if (type === "message")
      return { text: "Message", color: "text-blue-400 bg-blue-400/10" };
    return { text: type || "Message", color: "text-gray-400 bg-gray-400/10" };
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <MessageSquare className="h-5 w-5 text-green-500" />
          <span>Slack Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Slack integration by fetching recent messages from your
          workspace.
        </p>

        <Button
          onClick={testSlackConnection}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 transition-colors"
          aria-label="Test Slack connection"
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

        {data?.workspace && (
          <div className="text-xs text-gray-300 bg-gray-700/50 px-3 py-2 rounded">
            Connected to:{" "}
            <span className="font-medium text-green-400">{data.workspace}</span>
          </div>
        )}

        {data?.messages && data.messages.length > 0 && (
          <div className="mt-4 space-y-3">
            <h4 className="font-medium text-sm text-gray-300">
              Recent Messages ({data.messages.length})
            </h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.messages.map((message, index) => {
                const typeInfo = getMessageTypeInfo(
                  message.type,
                  message.subtype
                );
                return (
                  <Card
                    key={`${message.ts}-${index}`}
                    className="bg-gray-700/50 border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {message.channel_name && (
                              <div className="flex items-center text-xs text-gray-300 bg-gray-800/50 px-2 py-1 rounded">
                                <Hash className="h-3 w-3 mr-1" />
                                <span>{message.channel_name}</span>
                              </div>
                            )}
                            {message.username && (
                              <div className="flex items-center text-xs text-gray-300 bg-gray-800/50 px-2 py-1 rounded">
                                <User className="h-3 w-3 mr-1" />
                                <span>{message.username}</span>
                              </div>
                            )}
                            <div
                              className={`text-xs px-2 py-1 rounded ${typeInfo.color}`}
                            >
                              {typeInfo.text}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleExpandMessage(message.ts)}
                            className="text-gray-400 hover:text-gray-300 transition-colors"
                            aria-label={
                              expandedMessage === message.ts
                                ? "Collapse message"
                                : "Expand message"
                            }
                          >
                            {expandedMessage === message.ts ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center text-xs text-gray-400">
                          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{formatTimestamp(message.ts)}</span>
                        </div>

                        {message.text && (
                          <p
                            className={`text-sm text-gray-200 ${
                              expandedMessage === message.ts
                                ? "whitespace-pre-line"
                                : "line-clamp-3"
                            }`}
                          >
                            {formatMessageText(message.text)}
                          </p>
                        )}

                        {expandedMessage === message.ts && (
                          <div className="mt-2 pt-2 border-t border-gray-600 space-y-3">
                            {message.attachments?.map((attachment, idx) => (
                              <div
                                key={idx}
                                className="bg-gray-800/50 p-3 rounded"
                              >
                                {attachment.title && (
                                  <h5 className="font-medium text-sm text-gray-300 mb-1">
                                    {attachment.title}
                                  </h5>
                                )}
                                {attachment.text && (
                                  <p className="text-xs text-gray-400 whitespace-pre-line">
                                    {formatMessageText(attachment.text)}
                                  </p>
                                )}
                                {(attachment.image_url ||
                                  attachment.thumb_url) && (
                                  <div className="mt-2">
                                    <img
                                      src={
                                        attachment.image_url ||
                                        attachment.thumb_url
                                      }
                                      alt={
                                        attachment.title || "Slack attachment"
                                      }
                                      className="max-w-full h-auto rounded border border-gray-700"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}

                            {message.reactions?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {message.reactions.map((reaction, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center text-xs bg-gray-800/50 px-2 py-1 rounded"
                                  >
                                    <span className="mr-1">
                                      {reaction.name}
                                    </span>
                                    <span className="text-gray-300">
                                      {reaction.count}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
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

        {(!data || data.messages?.length === 0) && !loading && (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No messages to display. Click "Test Slack Connection" to fetch
              recent messages.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
