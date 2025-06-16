
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Loader2 } from "lucide-react";

export const SlackTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const testSlackConnection = async () => {
    setLoading(true);
    setResults(null);

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

      setResults(data);
      toast({
        title: "Success",
        description: "Slack connection test completed successfully.",
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
              Testing Slack Connection...
            </>
          ) : (
            "Test Slack Connection"
          )}
        </Button>

        {results && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h4 className="font-medium mb-2">Test Results:</h4>
            <pre className="text-xs overflow-x-auto text-gray-300">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
