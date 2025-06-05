
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

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
              variant="outline" 
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
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Gmail</span>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">Get updates from your Gmail inbox</p>
              <Button size="sm" disabled>Connect Gmail</Button>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Slack</span>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">Receive important Slack notifications</p>
              <Button size="sm" disabled>Connect Slack</Button>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Calendar</span>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">Stay updated with upcoming events</p>
              <Button size="sm" disabled>Connect Calendar</Button>
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
