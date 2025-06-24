
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  Loader2,
  Clock,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";

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
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  description?: string;
  status?: string;
  htmlLink?: string;
}

interface CalendarResponse {
  events: CalendarEvent[];
  error?: string;
}

export const CalendarTest = () => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const { toast } = useToast();

  const testCalendarConnection = async () => {
    setLoading(true);
    setEvents([]);
    setExpandedEvent(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || "No active session");
      }

      const { data, error } = await supabase.functions.invoke<CalendarResponse>(
        "fetch-calendar-events",
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setEvents(data.events || []);

      toast({
        title: "Calendar Connection Successful",
        description: `Fetched ${data.events?.length || 0} upcoming events.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Calendar test error:", error);
      toast({
        title: "Calendar Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatEventTime = (
    start: CalendarEvent["start"],
    end: CalendarEvent["end"]
  ) => {
    try {
      const startTime = start.dateTime || start.date;
      const endTime = end.dateTime || end.date;

      if (!startTime) return "Time not specified";

      const startDate = parseISO(startTime);
      const endDate = parseISO(endTime || startTime);

      if (start.date && !start.dateTime) {
        // All-day event
        return `All day - ${format(startDate, "MMM d, yyyy")}`;
      }

      // Check if events are on the same day
      const isSameDay = startDate.toDateString() === endDate.toDateString();

      if (isSameDay) {
        return `${format(startDate, "MMM d")} • ${format(
          startDate,
          "h:mm a"
        )} - ${format(endDate, "h:mm a")}`;
      }

      return `${format(startDate, "MMM d h:mm a")} - ${format(
        endDate,
        "MMM d h:mm a"
      )}`;
    } catch {
      return "Invalid date";
    }
  };

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case "confirmed":
        return { text: "Confirmed", color: "text-green-400 bg-green-400/10" };
      case "tentative":
        return { text: "Tentative", color: "text-yellow-400 bg-yellow-400/10" };
      case "cancelled":
        return { text: "Cancelled", color: "text-red-400 bg-red-400/10" };
      default:
        return { text: "Confirmed", color: "text-gray-400 bg-gray-400/10" };
    }
  };

  const getAttendeeStatus = (responseStatus?: string) => {
    switch (responseStatus?.toLowerCase()) {
      case "accepted":
        return "text-green-400";
      case "declined":
        return "text-red-400";
      case "tentative":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const toggleExpandEvent = (id: string) => {
    setExpandedEvent(expandedEvent === id ? null : id);
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Calendar className="h-5 w-5 text-blue-500" />
          <span>Calendar Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">
          Test your Google Calendar integration by fetching upcoming events.
        </p>

        <Button
          onClick={testCalendarConnection}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
          aria-label="Test Calendar connection"
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
          <div className="mt-4 space-y-3">
            <h4 className="font-medium text-sm text-gray-300">
              Upcoming Events ({events.length})
            </h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {events.map((event) => {
                const statusInfo = getStatusInfo(event.status);
                return (
                  <Card
                    key={event.id}
                    className="bg-gray-700/50 border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-medium text-sm text-white line-clamp-2">
                            {event.summary || "Untitled Event"}
                          </h5>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${statusInfo.color}`}
                            >
                              {statusInfo.text}
                            </span>
                            <button
                              onClick={() => toggleExpandEvent(event.id)}
                              className="text-gray-400 hover:text-gray-300 transition-colors"
                              aria-label={
                                expandedEvent === event.id
                                  ? "Collapse event"
                                  : "Expand event"
                              }
                            >
                              {expandedEvent === event.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center text-xs text-gray-300">
                          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{formatEventTime(event.start, event.end)}</span>
                        </div>

                        {event.location && (
                          <div className="flex items-start text-xs text-gray-400">
                            <MapPin className="h-3 w-3 mr-1 flex-shrink-0 mt-0.5" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}

                        {expandedEvent === event.id && (
                          <div className="mt-2 pt-2 border-t border-gray-600 space-y-3">
                            {event.description && (
                              <div className="text-xs text-gray-300 whitespace-pre-line">
                                {event.description
                                  .replace(/<[^>]*>/g, "")
                                  .trim()}
                              </div>
                            )}

                            {event.attendees && event.attendees.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-gray-400 mb-1">
                                  Attendees ({event.attendees.length})
                                </div>
                                <div className="space-y-1 text-xs">
                                  {event.attendees.map((attendee, index) => (
                                    <div
                                      key={index}
                                      className={`flex items-center ${getAttendeeStatus(
                                        attendee.responseStatus
                                      )}`}
                                    >
                                      <User className="h-3 w-3 mr-1 flex-shrink-0" />
                                      <span className="truncate">
                                        {attendee.displayName || attendee.email}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {event.htmlLink && (
                              <a
                                href={event.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Open in Google Calendar
                              </a>
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

        {events.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No events to display. Click "Test Calendar Connection" to fetch
              your upcoming events.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
