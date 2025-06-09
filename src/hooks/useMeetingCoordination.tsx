
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface MeetingRequest {
  attendeeEmails: string[];
  duration?: number;
  subject?: string;
  description?: string;
  preferredTimes?: string[];
}

interface MeetingSlot {
  start: Date;
  end: Date;
}

interface MeetingResponse {
  success: boolean;
  event?: any;
  selectedSlot?: MeetingSlot;
  alternativeSlots?: MeetingSlot[];
  message?: string;
  busyTimes?: any;
}

export const useMeetingCoordination = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const coordinateMeeting = async (meetingRequest: MeetingRequest): Promise<MeetingResponse | null> => {
    if (!user?.id) {
      setError(new Error('User not authenticated'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('coordinate-meeting', {
        body: meetingRequest
      });

      if (functionError) throw functionError;

      if (data.success) {
        toast({
          title: "Meeting scheduled successfully!",
          description: `Meeting created for ${new Date(data.selectedSlot.start).toLocaleString()}`,
        });
      } else {
        toast({
          title: "No suitable time found",
          description: data.message || "Unable to find a time that works for all attendees",
          variant: "destructive",
        });
      }

      return data;
    } catch (err) {
      console.error('Error coordinating meeting:', err);
      const errorMessage = err instanceof Error ? err : new Error(String(err));
      setError(errorMessage);
      
      toast({
        title: "Meeting coordination failed",
        description: errorMessage.message,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    coordinateMeeting,
    loading,
    error
  };
};
