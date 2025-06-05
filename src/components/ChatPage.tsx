
import { useState } from "react";
import { useUpdates } from "@/hooks/useUpdates";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

const ChatPage = () => {
  const [messages, setMessages] = useState<Array<{id: string, text: string, sender: 'user' | 'assistant'}>>([
    { id: '1', text: "Hi! I'm Chief, your AI assistant. I can help you stay updated with your notifications. What would you like to know?", sender: 'assistant' }
  ]);
  const [inputText, setInputText] = useState("");
  const { updates } = useUpdates();

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user' as const
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Simple AI responses based on input
    setTimeout(() => {
      let response = "";
      const lowerInput = inputText.toLowerCase();
      
      if (lowerInput.includes("update") || lowerInput.includes("notification")) {
        response = `You have ${updates.length} updates. Would you like me to go through them with you?`;
      } else if (lowerInput.includes("hello") || lowerInput.includes("hi")) {
        response = "Hello! How can I help you stay updated today?";
      } else {
        response = "I understand you're asking about staying updated. Is there something specific you'd like to know about your notifications?";
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'assistant' as const
      };

      setMessages(prev => [...prev, assistantMessage]);
    }, 500);

    setInputText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-semibold">Chat with Chief</h1>
        <p className="text-sm text-gray-400">Test the conversation flow</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <Button onClick={handleSendMessage} size="sm">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
