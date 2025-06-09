
import { useState, useRef } from "react";
import { useUpdates } from "@/hooks/useUpdates";
import { useUserDocuments } from "@/hooks/useUserDocuments";
import { useIntegrationData } from "@/hooks/useIntegrationData";
import { Button } from "@/components/ui/button";
import { Send, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const ChatPage = () => {
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    sender: 'user' | 'assistant';
  }>>([{
    id: '1',
    text: "Hi! I'm Chief, your AI assistant. I can help you stay updated with your notifications, answer questions about your uploaded documents, and provide insights from your connected integrations (Gmail, Calendar, Slack). What would you like to know?",
    sender: 'assistant'
  }]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { updates } = useUpdates();
  const { documents, refetch: refetchDocuments } = useUserDocuments();
  const { integrationData } = useIntegrationData();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);
    
    try {
      // Read file content
      const text = await file.text();
      
      // Upload to Supabase
      const { data, error } = await supabase
        .from('user_documents')
        .insert({
          user_id: user.id,
          name: file.name,
          content: text,
          file_type: file.type || 'text/plain',
          file_size: file.size
        })
        .select()
        .single();

      if (error) throw error;

      // Add a message to chat indicating successful upload
      const uploadMessage = {
        id: Date.now().toString(),
        text: `📎 Document "${file.name}" uploaded successfully and is now available for questions.`,
        sender: 'assistant' as const
      };
      setMessages(prev => [...prev, uploadMessage]);

      // Refresh documents list
      refetchDocuments();

      toast({
        title: "Document uploaded",
        description: `${file.name} has been uploaded and indexed.`,
      });

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

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
          integrationData: integrationData,
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <h1 className="text-xl font-semibold">Chat with Chief</h1>
        <p className="text-sm text-gray-400">
          AI assistant with access to your notifications, documents, and connected integrations
        </p>
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
            placeholder="Ask about your notifications, documents, or connected integrations..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <Button 
            onClick={handleAttachmentClick} 
            size="sm" 
            variant="outline"
            disabled={isLoading || isUploading}
            className="border-gray-600 hover:bg-gray-700"
          >
            <Paperclip size={16} />
          </Button>
          <Button onClick={handleSendMessage} size="sm" disabled={isLoading}>
            <Send size={16} />
          </Button>
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          accept=".txt,.md,.json,.csv,.pdf"
          style={{ display: 'none' }}
        />
        
        {isUploading && (
          <div className="mt-2 text-sm text-gray-400">
            Uploading document...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
