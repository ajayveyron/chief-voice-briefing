
import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { useEffect } from "react";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { integrations, loading, connectIntegration, disconnectIntegration, isConnected, refetch } = useIntegrations();

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

  const handleConnect = async (type: 'gmail' | 'calendar') => {
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
                  variant="outline"
                  onClick={() => handleDisconnect('gmail')}
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
                  variant="outline"
                  onClick={() => handleDisconnect('calendar')}
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

            {/* Slack Integration - Coming Soon */}
            <div className="p-4 bg-gray-800 rounded-lg opacity-50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Slack</span>
                <span className="text-sm text-gray-400">Coming soon</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">Receive important Slack notifications</p>
              <Button size="sm" disabled>Connect Slack</Button>
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
