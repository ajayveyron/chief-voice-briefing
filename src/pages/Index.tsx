
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import AuthForm from "@/components/AuthForm";
import BottomNav from "@/components/BottomNav";
import HomePage from "@/components/HomePage";
import ChatPage from "@/components/ChatPage";
import DataPage from "@/components/DataPage";
import SettingsPage from "@/components/SettingsPage";
import { ActionConfirmationDialog } from "@/components/ActionConfirmationDialog";

const Index = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("home");

  // Handle OAuth callback success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');
    
    if (connected) {
      toast({
        title: "Connected!",
        description: `${connected} has been connected successfully.`,
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      let errorMessage = 'An error occurred during connection.';
      
      switch (error) {
        case 'oauth_error':
          errorMessage = 'OAuth authentication was denied or failed.';
          break;
        case 'missing_params':
          errorMessage = 'Missing required parameters from OAuth provider.';
          break;
        case 'config_error':
          errorMessage = 'Server configuration error. Please contact support.';
          break;
        case 'invalid_state':
          errorMessage = 'Invalid authentication state. Please try again.';
          break;
        case 'token_exchange_failed':
          errorMessage = 'Failed to exchange authorization code for tokens.';
          break;
        case 'token_error':
          errorMessage = 'Error with OAuth tokens from provider.';
          break;
        case 'gmail_api_failed':
          errorMessage = 'Failed to access Gmail API. Please check permissions.';
          break;
        case 'calendar_api_failed':
          errorMessage = 'Failed to access Calendar API. Please check permissions.';
          break;
        case 'slack_api_failed':
          errorMessage = 'Failed to access Slack API. Please check permissions.';
          break;
        case 'storage_error':
          errorMessage = 'Failed to store integration data.';
          break;
        case 'unexpected_error':
          errorMessage = 'An unexpected error occurred.';
          break;
      }
      
      toast({
        title: "Connection failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case "home":
        return <HomePage />;
      case "chat":
        return <ChatPage />;
      case "data":
        return <DataPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-md mx-auto">
      {/* Main content area */}
      <div className="flex-1 pb-16">
        {renderActiveTab()}
      </div>
      
      {/* Bottom navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Action confirmation dialog */}
      <ActionConfirmationDialog />
    </div>
  );
};

export default Index;
