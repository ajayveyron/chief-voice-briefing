import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Data from "@/pages/Data";
import Settings from "@/pages/Settings";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";
import MCPServersPage from "@/pages/MCPServers";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Redirect root to home */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          
          {/* Auth routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          
          {/* Onboarding route - protected but outside main layout */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } />
          
          {/* Protected app routes */}
          <Route path="" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/home" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/data" element={<Data />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          
          {/* Other routes */}
          <Route path="/mcp" element={<MCPServersPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
