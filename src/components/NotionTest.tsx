
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Loader2,
  ExternalLink,
  Clock,
  Archive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  generateAndStoreEmbedding,
  formatNotionForEmbedding,
} from "@/utils/embeddingUtils";

interface NotionPage {
  id: string;
  title: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  properties?: Record<string, any>;
}

interface NotionResponse {
  success: boolean;
  pages: NotionPage[];
  total_count: number;
  workspace?: {
    name?: string;
    icon?: string;
  };
  error?: string;
}

export const NotionTest = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NotionResponse | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const { toast } = useToast();

  const testNotionConnection = async () => {
    setLoading(true);
    setData(null);
    setExpandedPage(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || "No active session");
      }

      const { data, error } = await supabase.functions.invoke<NotionResponse>(
        "fetch-notion-pages",
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (error) throw error;
      if (!data.success || data.error) {
        throw new Error(data.error || "Failed to fetch Notion pages");
      }

      setData(data);

      toast({
        title: "Notion Connection Successful",
        description: `Fetched ${
          data.pages?.length || 0
        } pages from your workspace.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Notion test error:", error);
      toast({
        title: "Notion Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandPage = (id: string) => {
    setExpandedPage(expandedPage === id ? null : id);
  };

  const formatPropertyValue = (value: any): string => {
    if (!value) return "Empty";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(formatPropertyValue).join(", ");
    if (value.name) return value.name;
    if (value.title) return value.title.map((t: any) => t.plain_text).join("");
    return JSON.stringify(value);
  };

  const embedPages = async () => {
    if (!data?.pages || data.pages.length === 0) {
      toast({
        title: "No Data to Embed",
        description: "Please fetch Notion pages first before embedding.",
        variant: "destructive",
      });
      return;
    }

    setEmbeddingLoading(true);
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || "No active session");
      }

      const embeddingData = formatNotionForEmbedding(data.pages, sessionData.session.user.id);
      
      for (const embeddingItem of embeddingData) {
        await generateAndStoreEmbedding(embeddingItem);
      }

      toast({
        title: "Pages Embedded Successfully",
        description: `${data.pages.length} Notion pages have been embedded into the vector store.`,
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
          <FileText className="h-5 w-5 text-purple-500" />
          <span>Notion Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Notion integration by fetching pages from your workspace.
        </p>

        <div className="flex gap-2">
          <Button
            onClick={testNotionConnection}
            disabled={loading}
            className="flex-1 bg-purple-600 hover:bg-purple-700 transition-colors"
            aria-label="Test Notion connection"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching Pages...
              </>
            ) : (
              "Test Notion Connection"
            )}
          </Button>

          <Button
            onClick={embedPages}
            disabled={embeddingLoading || !data?.pages || data.pages.length === 0}
            className="bg-purple-600 hover:bg-purple-700 transition-colors"
            aria-label="Embed pages into vector store"
          >
            {embeddingLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Embedding...
              </>
            ) : (
              "Embed Data"
            )}
          </Button>
        </div>

        {data && (
          <div className="mt-4 space-y-4">
            {data.workspace?.name && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span>Workspace:</span>
                <span className="font-medium">{data.workspace.name}</span>
              </div>
            )}

            <h4 className="font-medium text-sm text-gray-300">
              Pages ({data.total_count})
            </h4>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.pages.map((page) => (
                <Card
                  key={page.id}
                  className={`bg-gray-700/50 border-gray-600 hover:border-gray-500 transition-colors ${
                    page.archived ? "opacity-70" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-medium text-sm text-white line-clamp-2 flex-1">
                          {page.title || "Untitled"}
                        </h5>
                        <div className="flex items-center gap-2">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                            aria-label="Open in Notion"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => toggleExpandPage(page.id)}
                            className="text-gray-400 hover:text-gray-300 transition-colors"
                            aria-label={
                              expandedPage === page.id
                                ? "Collapse page"
                                : "Expand page"
                            }
                          >
                            {expandedPage === page.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>
                            Created{" "}
                            {formatDistanceToNow(new Date(page.created_time), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        {page.last_edited_time !== page.created_time && (
                          <div className="flex items-center">
                            <span>
                              Edited{" "}
                              {formatDistanceToNow(
                                new Date(page.last_edited_time),
                                { addSuffix: true }
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {page.archived && (
                        <div className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded inline-flex items-center gap-1">
                          <Archive className="h-3 w-3" />
                          <span>Archived</span>
                        </div>
                      )}

                      {expandedPage === page.id && page.properties && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <h6 className="text-xs font-medium text-gray-300 mb-2">
                            Properties
                          </h6>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {Object.entries(page.properties).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="bg-gray-800/50 p-2 rounded"
                                >
                                  <div className="font-medium text-gray-400">
                                    {key}
                                  </div>
                                  <div className="text-gray-300 truncate">
                                    {formatPropertyValue(value)}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!data && !loading && (
          <div className="text-center py-8 text-gray-400">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No pages to display. Click "Test Notion Connection" to fetch your
              workspace pages.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
