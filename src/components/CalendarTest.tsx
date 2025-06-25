
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Calendar, Database, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { embedData } from '../utils/embeddingUtils';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location?: string;
}

const CalendarTest = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-calendar', {
        body: { action: 'fetch' }
      });

      if (error) throw error;
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch calendar events');
    } finally {
      setLoading(false);
    }
  };

  const handleEmbedData = async () => {
    if (events.length === 0) {
      setError('No events to embed. Please fetch events first.');
      return;
    }

    setEmbedLoading(true);
    setError(null);

    try {
      await embedData(events, 'calendar');
      // Show success message or update UI
    } catch (err: any) {
      setError(err.message || 'Failed to embed data');
    } finally {
      setEmbedLoading(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Button 
          onClick={fetchEvents} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calendar className="h-4 w-4" />
          )}
          {loading ? 'Fetching...' : 'Fetch Events'}
        </Button>

        <Button
          onClick={handleEmbedData}
          disabled={embedLoading || events.length === 0}
          variant="outline"
          className="flex items-center gap-2"
        >
          {embedLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          {embedLoading ? 'Embedding...' : 'Embed Data'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {events.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Upcoming Events</h3>
                <Badge variant="secondary">{events.length} events</Badge>
              </div>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-4">
                {events.map((event, index) => (
                  <div key={event.id}>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium">{event.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDateTime(event.start_time)}</span>
                          </div>
                        </div>
                        <Badge variant="outline">Event</Badge>
                      </div>
                      
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      
                      {event.location && (
                        <p className="text-xs text-muted-foreground">
                          📍 {event.location}
                        </p>
                      )}
                    </div>
                    {index < events.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!loading && events.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No events loaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Fetch Events" to load your calendar events
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalendarTest;
