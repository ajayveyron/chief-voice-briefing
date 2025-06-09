
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
    localStorage.setItem('customInstructions', customInstructions);
    toast({
      title: "Instructions saved",
      description: "Your custom instructions have been saved and will be used by the AI assistant.",
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('customInstructions');
    if (saved) {
      setCustomInstructions(saved);
    }
  }, []);

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
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
                  <Mail size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Gmail</h3>
                  <p className="text-sm text-gray-400">Get updates from your Gmail inbox</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {isConnected('gmail') ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-sm text-gray-300">Connected</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDisconnect('gmail')}
                      className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-400">Not connected</span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleConnect('gmail')}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Connect
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Calendar Integration */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
                  <Calendar size={24} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Calendar</h3>
                  <p className="text-sm text-gray-400">Stay updated with upcoming events</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {isConnected('calendar') ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-sm text-gray-300">Connected</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDisconnect('calendar')}
                      className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-400">Not connected</span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleConnect('calendar')}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Connect
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Slack Integration */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
                  <MessageSquare size={24} className="text-green-500" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Slack</h3>
                  <p className="text-sm text-gray-400">Receive important Slack notifications</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {isConnected('slack') ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-sm text-gray-300">Connected</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDisconnect('slack')}
                      className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-400">Not connected</span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleConnect('slack')}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Connect
                    </Button>
                  </>
                )}
              </div>
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
