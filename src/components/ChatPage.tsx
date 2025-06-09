
import { useState } from "react";
import { useUpdates } from "@/hooks/useUpdates";
import { useUserDocuments } from "@/hooks/useUserDocuments";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ChatPage = () => {
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    sender: 'user' | 'assistant';
  }>>([{
    id: '1',
    text: "Hi! I'm Chief, your virtual assistant. I can help you stay updated with your notifications and answer questions about your uploaded documents. What would you like to know?",
    sender: 'assistant'
  }]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
          customInstructions: customInstructions
        }
      });

      if (error) {
        throw error;
      }

      if (data?.generatedText && data.generatedText.trim()) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          text: data.generatedText,
          sender: 'assistant' as const
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error calling AI:', error);
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

  return (
    <div className="h-screen flex flex-col pb-16">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <h1 className="text-xl font-semibold">Chat with Chief</h1>
        
      </div>

      {/* Messages Container - takes up remaining space */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
              {message.text}
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
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your notifications or uploaded documents..."
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
