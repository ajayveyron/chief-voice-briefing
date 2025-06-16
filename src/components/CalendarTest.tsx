
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2 } from "lucide-react";

export const CalendarTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const testCalendarConnection = async () => {
    setLoading(true);
    setResults(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('fetch-calendar-events', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) throw error;

      setResults(data);
      toast({
        title: "Success",
        description: "Calendar connection test completed successfully.",
      });
    } catch (error) {
      console.error('Calendar test error:', error);
      toast({
        title: "Error",
        description: `Calendar test failed: ${error.message}`,
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
          <Calendar className="h-5 w-5 text-blue-500" />
          <span>Calendar Test</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Google Calendar integration by fetching upcoming events.
        </p>
        
        <Button
          onClick={testCalendarConnection}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Calendar Connection...
            </>
          ) : (
            "Test Calendar Connection"
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
