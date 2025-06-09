
import { useChat } from 'ai/react';

export const useSimpleChat = () => {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput
  } = useChat({
    api: '/api/chat',
    initialMessages: [{
      id: '1',
      content: "Hi! I'm your AI assistant. How can I help you today?",
      role: 'assistant'
    }]
  });

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput
  };
};
