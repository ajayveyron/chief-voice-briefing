import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Clock,
  CheckCircle,
  Calendar,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActionExecution } from "@/hooks/useActionExecution";

interface Message {
  id: string;
  text: string;
  sender: "user" | "chief";
  timestamp: Date;
  actionSuggestions?: ActionSuggestion[];
  executionResults?: any[];
}

interface ActionSuggestion {
  id: string;
  type: string;
  prompt: string;
  confidence: number;
  requiresConfirmation: boolean;
}

interface ChiefInterfaceProps {
  onVoiceToggle?: () => void;
  isVoiceMode?: boolean;
}

export const ChiefInterface: React.FC<ChiefInterfaceProps> = ({
  onVoiceToggle,
  isVoiceMode = false,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm Chief, your AI executive assistant. I can help you manage emails, calendar events, Slack messages, and more. I'm proactive and context-aware, so I'll suggest actions based on your incoming data. How can I assist you today?",
      sender: "chief",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { pendingActions } = useActionExecution();

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
          conversationHistory: messages.slice(-5), // Last 5 messages for context
        },
      });

      if (error) throw error;

      if (data?.response) {
        const chiefMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: "chief",
          timestamp: new Date(),
          actionSuggestions: data.suggestions || [],
          executionResults: data.executionResults || [],
        };
        setMessages((prev) => [...prev, chiefMessage]);
      }
    } catch (error) {
      console.error("Error calling Chief AI:", error);
      toast({
        title: "Connection Error",
        description:
          "I'm having trouble connecting right now. Please try again.",
        variant: "destructive",
      });
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-emerald-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "send_email":
        return <Send className="h-3 w-3" />;
      case "schedule_meeting":
        return <Calendar className="h-3 w-3" />;
      case "create_reminder":
        return <Bell className="h-3 w-3" />;
      default:
        return <CheckCircle className="h-3 w-3" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Chief Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                AI Executive Assistant •{" "}
                {isVoiceMode ? "Voice Mode" : "Text Mode"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {pendingActions.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingActions.length} Pending
              </Badge>
            )}
            {onVoiceToggle && (
              <Button
                variant="outline"
                size="sm"
                onClick={onVoiceToggle}
                className="flex items-center space-x-2"
              >
                {isVoiceMode ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span>{isVoiceMode ? "Text" : "Voice"}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
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
                  className={`rounded-lg p-4 ${
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
                      <p className="text-sm leading-relaxed">{message.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Suggestions */}
                  {message.actionSuggestions &&
                    message.actionSuggestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/20">
                        <p className="text-xs font-medium mb-2 opacity-80">
                          Suggested Actions:
                        </p>
                        <div className="space-y-2">
                          {message.actionSuggestions.map((suggestion) => (
                            <Card
                              key={suggestion.id}
                              className="border-border/30"
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {getActionIcon(suggestion.type)}
                                    <span className="text-xs font-medium">
                                      {suggestion.type}
                                    </span>
                                    <div
                                      className={`w-2 h-2 rounded-full ${getConfidenceColor(
                                        suggestion.confidence
                                      )}`}
                                      title={`Confidence: ${Math.round(
                                        suggestion.confidence * 100
                                      )}%`}
                                    />
                                  </div>
                                  <Badge
                                    variant={
                                      suggestion.requiresConfirmation
                                        ? "outline"
                                        : "secondary"
                                    }
                                  >
                                    {suggestion.requiresConfirmation
                                      ? "Manual"
                                      : "Auto"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {suggestion.prompt}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Execution Results */}
                  {message.executionResults &&
                    message.executionResults.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/20">
                        <p className="text-xs font-medium mb-2 opacity-80">
                          Actions Executed:
                        </p>
                        <div className="space-y-1">
                          {message.executionResults.map((result, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-2"
                            >
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                              <span className="text-xs">
                                {result.message || "Action completed"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
      {!isVoiceMode && (
        <div className="p-4 border-t border-border bg-card">
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">
              Try: "Send an email to john@example.com about the meeting" or
              "What are my updates?"
            </p>
          </div>
          <div className="flex space-x-2">
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
              onClick={handleSendMessage}
              size="sm"
              disabled={isLoading || !inputText.trim()}
              className="px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
