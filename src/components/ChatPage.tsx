
import { useState } from "react";
import { useUpdates } from "@/hooks/useUpdates";
import { useUserDocuments } from "@/hooks/useUserDocuments";
import { Button } from "@/components/ui/button";
import { Send, Mail, CheckCircle, XCircle, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RealtimeVoiceChief from "@/components/RealtimeVoiceChief";

const ChatPage = () => {
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    sender: 'user' | 'assistant';
    emailSent?: any;
    emailDetails?: any;
  }>>([{
    id: '1',
    text: "Hi! I'm Chief, your virtual assistant. I can help you stay updated with your notifications, answer questions about your uploaded documents, and take actions like sending emails. What would you like to do?",
    sender: 'assistant'
  }]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const { updates } = useUpdates();
  const { documents } = useUserDocuments();

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user' as const
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chief-ai-chat', {
        body: {
          message: inputText,
          includeContext: true
        }
      });

      if (error) {
        throw error;
      }

      if (data?.response && data.response.trim()) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: 'assistant' as const,
          emailSent: data.emailSent,
          emailDetails: data.emailDetails
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error calling Chief AI:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please try again.",
        sender: 'assistant' as const
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isVoiceMode) {
    return (
      <div className="relative">
        <RealtimeVoiceChief />
        <Button 
          onClick={() => setIsVoiceMode(false)} 
          variant="outline" 
          size="sm"
          className="absolute top-4 right-4 z-10 flex items-center gap-2"
        >
          Text Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col pb-16">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Chat with Chief</h1>
            <p className="text-sm text-gray-400">Your AI assistant that can send emails, manage calendar, and more</p>
          </div>
          <Button 
            onClick={() => setIsVoiceMode(true)} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <Mic size={16} />
            Voice
          </Button>
        </div>
      </div>

      {/* Messages Container - takes up remaining space */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
              <div>{message.text}</div>
              
              {/* Show email status if email was sent */}
              {message.emailSent && (
                <div className="mt-2 p-2 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Mail size={16} />
                    <span>Email Action</span>
                  </div>
                  
                  {message.emailDetails && (
                    <div className="mt-1 text-xs text-gray-300">
                      To: {message.emailDetails.to.join(', ')}<br/>
                      Subject: {message.emailDetails.subject}
                    </div>
                  )}
                  
                  <div className={`flex items-center gap-1 mt-1 ${message.emailSent.success ? 'text-green-400' : 'text-red-400'}`}>
                    {message.emailSent.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    <span className="text-xs">
                      {message.emailSent.success ? 'Email sent successfully!' : `Failed: ${message.emailSent.error}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-200 p-3 rounded-lg">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Section - Fixed at bottom */}
      <div className="p-4 border-t border-gray-700 bg-black flex-shrink-0">
        <div className="mb-2">
          <p className="text-xs text-gray-500">
            Try: "Send an email to john@example.com saying our meeting is rescheduled to 4PM"
          </p>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to send emails, schedule meetings, or anything else..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <Button onClick={handleSendMessage} size="sm" disabled={isLoading}>
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
