import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Loader2,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SearchResult {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  content: string;
  metadata: any;
  similarity: number;
  created_at: string;
}

interface SearchResponse {
  results: SearchResult[];
  error?: string;
}

export const VectorSearchTest = () => {
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const performSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Search Query Required",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || "No active session");
      }

      const searchParams: any = {
        query: query.trim(),
        topK: 10,
        user_id: user?.id,
      };

      if (sourceType && sourceType.trim() !== "") {
        searchParams.source_type = sourceType;
      }

      const { data, error } = await supabase.functions.invoke<SearchResponse>(
        "vector-search",
        {
          body: searchParams,
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults(data.results || []);

      toast({
        title: "Search Completed",
        description: `Found ${data.results?.length || 0} relevant results.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Vector search error:", error);
      toast({
        title: "Search Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testGenerateEmbeddings = async () => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || "No active session");
      }

      const testParams = {
        user_id: user?.id,
        source_type: "gmail",
        source_id: "test-123",
        content: "This is a test content for embedding generation",
        metadata: { test: true },
      };

      const { data, error } = await supabase.functions.invoke(
        "generate-embeddings",
        {
          body: testParams,
        }
      );

      if (error) throw error;

      toast({
        title: "Test Successful",
        description: "generate-embeddings function is working!",
      });
      console.log("generate-embeddings test result:", data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("generate-embeddings test error:", error);
      toast({
        title: "Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "gmail":
        return <Mail className="h-4 w-4 text-red-500" />;
      case "calendar":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "notion":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "slack":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatSimilarity = (similarity: number) => {
    return `${(similarity * 100).toFixed(1)}%`;
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Search className="h-5 w-5 text-blue-500" />
          <span>Vector Search</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Search through your embedded data using semantic similarity. Find
          relevant emails, calendar events, and other content.
        </p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="search-query" className="text-sm text-gray-300">
              Search Query
            </Label>
            <Input
              id="search-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="mt-1 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  performSearch();
                }
              }}
            />
          </div>

          <div>
            <Label htmlFor="source-type" className="text-sm text-gray-300">
              Source Type (Optional)
            </Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-gray-100">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="calendar">Calendar</SelectItem>
                <SelectItem value="notion">Notion</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={performSearch}
            disabled={loading || !query.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>

          <Button
            onClick={testGenerateEmbeddings}
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Test generate-embeddings Function
          </Button>
        </div>

        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-sm text-gray-300">
              Search Results ({results.length})
            </h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <Card
                  key={`${result.id}-${index}`}
                  className="bg-gray-700/50 border-gray-600 hover:border-gray-500 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getSourceIcon(result.source_type)}
                          <span className="text-xs text-gray-400 uppercase">
                            {result.source_type}
                          </span>
                        </div>
                        <span className="text-xs text-green-400 font-mono">
                          {formatSimilarity(result.similarity)}
                        </span>
                      </div>

                      {result.metadata?.subject && (
                        <h5 className="font-medium text-sm text-gray-100">
                          {result.metadata.subject}
                        </h5>
                      )}

                      {result.metadata?.from && (
                        <p className="text-xs text-gray-400">
                          From: {result.metadata.from}
                        </p>
                      )}

                      <p className="text-xs text-gray-300 leading-relaxed">
                        {truncateContent(result.content)}
                      </p>

                      {result.metadata?.date && (
                        <p className="text-xs text-gray-500">
                          {new Date(result.metadata.date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && !loading && query && (
          <div className="text-center py-8 text-gray-400">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No results found for "{query}". Try a different search term or
              check if you have embedded data.
            </p>
          </div>
        )}

        {!query && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Enter a search query to find relevant content from your embedded
              data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
