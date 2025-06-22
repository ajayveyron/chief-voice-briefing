import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  text: string;
  sender: "user" | "chief";
  timestamp: Date;
}

const ChiefInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm Chief, your AI executive assistant. How can I assist you today?",
      sender: "chief",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chief-ai-chat", {
        body: {
          message: inputText,
          includeContext: true,
          conversationHistory: messages.slice(-5),
        },
      });
      if (error) throw error;
      if (data?.response) {
        const chiefMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: "chief",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, chiefMessage]);
      }
    } catch (error) {
      // Optionally show a toast or error message
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f2027] via-[#2c5364] to-[#232526] p-4">
      <Card className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 flex flex-col items-center p-0">
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <Avatar className="w-20 h-20 mb-2 border-4 border-white/30 bg-gray-900">
            <AvatarFallback className="text-4xl">👔</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Chief
          </h1>
          <p className="text-base text-gray-200 font-medium">
            Your AI Chief of Staff
          </p>
        </div>
        {/* Chat Timeline */}
        <ScrollArea
          ref={scrollRef}
          className="flex-1 w-full px-4 pb-4 max-h-[80vh]"
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] ${
                    message.sender === "user" ? "order-2" : "order-1"
                  }`}
                >
                  <div
                    className={`rounded-lg p-4 shadow-md ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.sender === "chief" && (
                        <Avatar className="h-6 w-6 mt-0.5">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            <Bot className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {message.sender === "user" && (
                        <Avatar className="h-6 w-6 mt-0.5 order-2">
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                            <User className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">
                          {message.text}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs opacity-70 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-4 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        <Bot className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        {/* Input */}
        <div className="w-full p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
          <form
            className="flex space-x-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Chief to take actions, get updates, or answer questions..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary disabled:opacity-50"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !inputText.trim()}
              className="px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ChiefInterface;
