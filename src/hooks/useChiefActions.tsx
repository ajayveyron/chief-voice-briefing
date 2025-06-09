
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  scheduledFor?: string;
}

interface CalendarEventRequest {
  action: 'create' | 'update' | 'delete';
  eventId?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
}

interface SlackMessageRequest {
  channel?: string;
  user?: string;
  text: string;
  scheduledFor?: string;
}

export const useChiefActions = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendEmail = useCallback(async (emailRequest: EmailRequest) => {
    try {
      setLoading(true);
      console.log('📧 Sending email...');

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: emailRequest
      });

      if (error) {
        throw error;
      }

      console.log('✅ Email sent successfully');
      toast({
        title: "Success",
        description: emailRequest.scheduledFor 
          ? `Email scheduled for ${new Date(emailRequest.scheduledFor).toLocaleString()}`
          : "Email sent successfully",
      });
      
      return data;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const manageCalendarEvent = useCallback(async (eventRequest: CalendarEventRequest) => {
    try {
      setLoading(true);
      console.log(`📅 ${eventRequest.action} calendar event...`);

      const { data, error } = await supabase.functions.invoke('manage-calendar', {
        body: eventRequest
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Calendar event ${eventRequest.action} successful`);
      toast({
        title: "Success",
        description: `Calendar event ${eventRequest.action} successful`,
      });
      
      return data;
    } catch (error) {
      console.error(`❌ Error ${eventRequest.action} calendar event:`, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${eventRequest.action} calendar event`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const sendSlackMessage = useCallback(async (messageRequest: SlackMessageRequest) => {
    try {
      setLoading(true);
      console.log('💬 Sending Slack message...');

      const { data, error } = await supabase.functions.invoke('send-slack-message', {
        body: messageRequest
      });

      if (error) {
        throw error;
      }

      console.log('✅ Slack message sent successfully');
      toast({
        title: "Success",
        description: messageRequest.scheduledFor 
          ? `Slack message scheduled for ${new Date(messageRequest.scheduledFor).toLocaleString()}`
          : "Slack message sent successfully",
      });
      
      return data;
    } catch (error) {
      console.error('❌ Error sending Slack message:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send Slack message',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const chatWithChief = useCallback(async (message: string, includeContext = true) => {
    try {
      setLoading(true);
      console.log('🤖 Chatting with Chief...');

      const { data, error } = await supabase.functions.invoke('chief-ai-chat', {
        body: { message, includeContext }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Chief response received');
      return data;
    } catch (error) {
      console.error('❌ Error chatting with Chief:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to chat with Chief',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    sendEmail,
    manageCalendarEvent,
    sendSlackMessage,
    chatWithChief
  };
};
