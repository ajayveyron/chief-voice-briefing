
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, ExternalLink, Clock, Archive } from "lucide-react";

interface NotionPage {
  id: string;
  title: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
}

interface NotionResponse {
  success: boolean;
  pages: NotionPage[];
  total_count: number;
  workspace?: any;
}

export const NotionTest = () => {
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const testNotionConnection = async () => {
    setLoading(true);
    setPages([]);
    setTotalCount(0);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('fetch-notion-pages', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) throw error;

      const response = data as NotionResponse;
      if (response.success) {
        setPages(response.pages || []);
        setTotalCount(response.total_count || 0);
        
        toast({
          title: "Success",
          description: `Fetched ${response.total_count || 0} pages from Notion.`,
        });
      } else {
        throw new Error('Failed to fetch Notion pages');
      }
    } catch (error) {
      console.error('Notion test error:', error);
      toast({
        title: "Error",
        description: `Notion test failed: ${error.message}`,
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
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
      return formatDate(dateStr);
    } catch {
      return formatDate(dateStr);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-purple-500" />
          <span>Notion Test</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Notion integration by fetching pages from your workspace.
        </p>
        
        <Button
          onClick={testNotionConnection}
          disabled={loading}
          className="w-full"
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

        {pages.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-sm">Pages from Workspace ({totalCount})</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pages.map((page) => (
                <Card key={page.id} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-medium text-sm text-white line-clamp-2 flex-1">
                          {page.title || "Untitled"}
                        </h5>
                        <div className="flex items-center gap-2">
                          {page.archived && (
                            <Archive className="h-4 w-4 text-gray-500" />
                          )}
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-400">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>Created {getRelativeTime(page.created_time)}</span>
                        </div>
                        
                        {page.last_edited_time !== page.created_time && (
                          <div className="flex items-center">
                            <span className="hidden sm:inline mx-2">•</span>
                            <span>Edited {getRelativeTime(page.last_edited_time)}</span>
                          </div>
                        )}
                      </div>
                      
                      {page.archived && (
                        <div className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                          This page is archived
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {pages.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No pages to display. Click "Test Notion Connection" to fetch your workspace pages.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
