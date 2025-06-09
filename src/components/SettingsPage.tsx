
import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, CheckCircle, AlertCircle, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { integrations, loading, connectIntegration, disconnectIntegration, isConnected, refetch } = useIntegrations();
  const [customInstructions, setCustomInstructions] = useState("");

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out.",
        variant: "destructive",
      });
    }
  };

  const handleConnect = async (type: 'gmail' | 'calendar' | 'slack') => {
    try {
      await connectIntegration(type);
    } catch (error) {
      toast({
        title: "Connection failed",
        description: `Failed to connect ${type}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (type: string) => {
    try {
      await disconnectIntegration(type);
      toast({
        title: "Disconnected",
        description: `${type} has been disconnected successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to disconnect ${type}.`,
        variant: "destructive",
      });
    }
  };

  const handleSaveInstructions = () => {
    // For now, just save to localStorage. In a real app, this would save to the database
    localStorage.setItem('customInstructions', customInstructions);
    toast({
      title: "Instructions saved",
      description: "Your custom instructions have been saved and will be used by the AI assistant.",
    });
  };

  useEffect(() => {
    // Load saved instructions from localStorage
    const saved = localStorage.getItem('customInstructions');
    if (saved) {
      setCustomInstructions(saved);
    }
  }, []);

  // Check for connection success or errors from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');
    
    if (connected) {
      toast({
        title: "Connected!",
        description: `${connected} has been connected successfully.`,
      });
      refetch();
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
      
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast, refetch]);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your account and integrations</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Account Section */}
        <div>
          <h2 className="text-lg font-medium mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-gray-400">{user?.email}</p>
              </div>
            </div>
            <Button 
              onClick={handleSignOut}
              variant="default" 
              className="w-full"
            >
              Sign Out
            </Button>
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Custom Instructions Section */}
        <div>
          <h2 className="text-lg font-medium mb-4">AI Assistant Instructions</h2>
          <div className="space-y-3">
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-sm font-medium mb-2">Custom Instructions</p>
              <p className="text-xs text-gray-400 mb-3">
                Provide specific instructions to customize how the AI assistant responds to you. For example, mention your role, preferences, or specific contexts you want the AI to consider.
              </p>
              <Textarea
                placeholder="Enter your custom instructions here... For example: 'I'm a software engineer working on web applications. Please provide technical responses and focus on best practices. I prefer concise explanations with code examples.'"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="min-h-[100px] bg-gray-900 border-gray-600 text-white placeholder-gray-400"
              />
              <Button 
                onClick={handleSaveInstructions}
                className="mt-3"
                size="sm"
              >
                Save Instructions
              </Button>
            </div>
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Integrations Section */}
        <div>
          <h2 className="text-lg font-medium mb-4">Integrations</h2>
          <div className="space-y-3">
            {/* Gmail Integration */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <Mail size={20} className="text-red-500" />
                  <span className="font-medium">Gmail</span>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected('gmail') ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <AlertCircle size={16} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-400">
                    {isConnected('gmail') ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-3">Get updates from your Gmail inbox</p>
              {isConnected('gmail') ? (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDisconnect('gmail')}
                  className="bg-red-700 hover:bg-red-800 text-white"
                >
                  Disconnect
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => handleConnect('gmail')}
                  disabled={loading}
                >
                  Connect Gmail
                </Button>
              )}
            </div>

            {/* Calendar Integration */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar size={20} className="text-blue-500" />
                  <span className="font-medium">Calendar</span>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected('calendar') ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <AlertCircle size={16} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-400">
                    {isConnected('calendar') ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-3">Stay updated with upcoming events</p>
              {isConnected('calendar') ? (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDisconnect('calendar')}
                  className="bg-red-700 hover:bg-red-800 text-white"
                >
                  Disconnect
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => handleConnect('calendar')}
                  disabled={loading}
                >
                  Connect Calendar
                </Button>
              )}
            </div>

            {/* Slack Integration */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <MessageSquare size={20} className="text-green-500" />
                  <span className="font-medium">Slack</span>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected('slack') ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <AlertCircle size={16} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-400">
                    {isConnected('slack') ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-3">Receive important Slack notifications</p>
              {isConnected('slack') ? (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDisconnect('slack')}
                  className="bg-red-700 hover:bg-red-800 text-white"
                >
                  Disconnect
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => handleConnect('slack')}
                  disabled={loading}
                >
                  Connect Slack
                </Button>
              )}
            </div>
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Voice Settings */}
        <div>
          <h2 className="text-lg font-medium mb-4">Voice Settings</h2>
          <div className="space-y-3">
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="font-medium mb-2">Voice Speed</p>
              <p className="text-sm text-gray-500">Coming soon...</p>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="font-medium mb-2">Auto-play Updates</p>
              <p className="text-sm text-gray-500">Coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
