
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUpdates } from '@/hooks/useUpdates';
import { useUserDocuments } from '@/hooks/useUserDocuments';
import { useIntegrationData } from '@/hooks/useIntegrationData';
import { useMeetingCoordination } from '@/hooks/useMeetingCoordination';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
}

export const useAIChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    text: "Hi! I'm Chief, your AI assistant. I can help you stay updated with your notifications, answer questions about your uploaded documents, and provide insights from your connected integrations (Gmail, Calendar, Slack). What would you like to know?",
    sender: 'assistant'
  }]);
  const [isLoading, setIsLoading] = useState(false);

  const { updates } = useUpdates();
  const { documents } = useUserDocuments();
  const { integrationData } = useIntegrationData();
  const { coordinateMeeting } = useMeetingCoordination();

  const sendMessage = async (inputText: string) => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user'
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Check if this is a meeting coordination request
      const isMeetingRequest = /schedule|meeting|coordinate|calendar|book|arrange.*meeting/i.test(inputText);
      
      // Try to extract meeting details if it's a meeting request
      if (isMeetingRequest && inputText.includes('@')) {
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
        const emails = inputText.match(emailRegex);
        
        if (emails && emails.length > 0) {
          // Extract other details
          const durationMatch = inputText.match(/(\d+)\s*(hour|hr|minute|min)/i);
          const duration = durationMatch ? parseInt(durationMatch[1]) * (durationMatch[2].toLowerCase().includes('hour') ? 60 : 1) : 60;
          
          const subjectMatch = inputText.match(/(?:subject|title|about|regarding):\s*"([^"]+)"/i) || 
                               inputText.match(/(?:subject|title|about|regarding):\s*([^\n,]+)/i);
          const subject = subjectMatch ? subjectMatch[1].trim() : 'Team Meeting';

          console.log('Attempting to coordinate meeting:', { emails, duration, subject });

          try {
            const result = await coordinateMeeting({
              attendeeEmails: emails,
              duration,
              subject,
              description: `Meeting coordinated by Chief AI Assistant based on request: "${inputText}"`
            });

            if (result) {
              const responseMessage = result.success 
                ? `✅ Meeting scheduled successfully!\n\n📅 **${result.event.summary}**\n🕐 ${new Date(result.selectedSlot.start).toLocaleString()} - ${new Date(result.selectedSlot.end).toLocaleString()}\n👥 Attendees: ${emails.join(', ')}\n🔗 [Join Meeting](${result.event.hangoutLink || result.event.htmlLink})\n\nInvitations have been sent to all attendees.`
                : `❌ ${result.message || 'Unable to find a suitable time for all attendees'}\n\nWould you like me to suggest alternative approaches or different time preferences?`;

              const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                text: responseMessage,
                sender: 'assistant'
              };
              setMessages(prev => [...prev, assistantMessage]);
              setIsLoading(false);
              return;
            }
          } catch (meetingError) {
            console.error('Meeting coordination error:', meetingError);
            // Fall through to regular AI chat if meeting coordination fails
          }
        }
      }

      const customInstructions = localStorage.getItem('customInstructions') || '';
      
      const conversationMessages = messages
        .filter(msg => msg.text && msg.text.trim())
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      conversationMessages.push({
        role: 'user',
        content: inputText
      });

      const { data, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          messages: conversationMessages,
          userUpdates: updates,
          userDocuments: documents,
          integrationData: integrationData,
          customInstructions: customInstructions
        }
      });

      if (error) {
        throw error;
      }

      if (data?.generatedText && data.generatedText.trim()) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: data.generatedText,
          sender: 'assistant'
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please try again.",
        sender: 'assistant'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    sendMessage
  };
};
