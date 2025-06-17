
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2, Clock, MapPin, Users } from "lucide-react";

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  description?: string;
  status?: string;
}

interface CalendarResponse {
  events: CalendarEvent[];
}

export const CalendarTest = () => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const { toast } = useToast();

  const testCalendarConnection = async () => {
    setLoading(true);
    setEvents([]);

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

      const response = data as CalendarResponse;
      setEvents(response.events || []);
      
      toast({
        title: "Success",
        description: `Fetched ${response.events?.length || 0} upcoming events.`,
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

  const formatEventTime = (start: CalendarEvent['start'], end: CalendarEvent['end']) => {
    try {
      const startTime = start.dateTime || start.date;
      const endTime = end.dateTime || end.date;
      
      if (!startTime) return "Time not specified";
      
      const startDate = new Date(startTime);
      const endDate = new Date(endTime || startTime);
      
      if (start.date && !start.dateTime) {
        // All-day event
        return `All day - ${startDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`;
      }
      
      const isSameDay = startDate.toDateString() === endDate.toDateString();
      
      if (isSameDay) {
        return `${startDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })} • ${startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit'
        })} - ${endDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit'
        })}`;
      }
      
      return `${startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} ${startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })} - ${endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} ${endDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })}`;
    } catch {
      return "Invalid date";
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-400';
      case 'tentative': return 'text-yellow-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
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
              Fetching Events...
            </>
          ) : (
            "Test Calendar Connection"
          )}
        </Button>

        {events.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-sm">Upcoming Events ({events.length})</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {events.map((event) => (
                <Card key={event.id} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-medium text-sm text-white line-clamp-2">
                          {event.summary || "Untitled Event"}
                        </h5>
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-700 ${getStatusColor(event.status)}`}>
                          {event.status || 'confirmed'}
                        </span>
                      </div>
                      
                      <div className="flex items-center text-xs text-gray-300">
                        <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{formatEventTime(event.start, event.end)}</span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center text-xs text-gray-400">
                          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center text-xs text-gray-400">
                          <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">
                            {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      
                      {event.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {event.description.replace(/<[^>]*>/g, '').trim()}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events to display. Click "Test Calendar Connection" to fetch your upcoming events.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
