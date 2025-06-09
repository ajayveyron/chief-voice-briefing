
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Configure the AI SDK to use Supabase functions
const chatApiEndpoint = `${supabase.supabaseUrl}/functions/v1/chat-with-ai`;

// Set the global fetch to include auth headers for AI SDK
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  // Only intercept requests to our chat API
  if (typeof input === 'string' && input.includes('/api/chat')) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    
    const headers = {
      ...init?.headers,
      'apikey': supabase.supabaseKey,
      'Authorization': `Bearer ${token || supabase.supabaseKey}`,
    };

    // Replace /api/chat with our Supabase function URL
    const url = input.replace('/api/chat', chatApiEndpoint);
    
    return originalFetch(url, {
      ...init,
      headers,
    });
  }
  
  return originalFetch(input, init);
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
