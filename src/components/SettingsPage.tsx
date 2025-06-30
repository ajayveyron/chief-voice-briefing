import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  Calendar,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  FileText,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

const integrationsItems = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Get updates from your Gmail inbox",
    icon: Mail,
    color: "text-red-500",
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Stay updated with upcoming events",
    icon: Calendar,
    color: "text-blue-500",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Receive important Slack notifications",
    icon: MessageSquare,
    color: "text-green-500",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sync with your Notion workspace",
    icon: FileText,
    color: "text-purple-500",
  },
];

// Profile type for local state
type UserProfile = {
  first_name: string;
  last_name: string;
};

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const {
    loading,
    connectIntegration,
    disconnectIntegration,
    isConnected,
    refetch,
  } = useIntegrations();
  const [customInstructions, setCustomInstructions] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Fetch profile info on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();
      if (!error && data) {
        setProfile({ first_name: data.first_name, last_name: data.last_name });
      }
    };
    fetchProfile();
  }, [user?.id]);

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

  const handleConnect = async (type) => {
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

  const handleDisconnect = async (type) => {
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
    localStorage.setItem("customInstructions", customInstructions);
    toast({
      title: "Instructions saved",
      description:
        "Your custom instructions have been saved and will be used by the AI assistant.",
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem("customInstructions");
    if (saved) setCustomInstructions(saved);
  }, []);

  // Modern UI Layout
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f2027] via-[#2c5364] to-[#232526] p-4">
      <Card className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 flex flex-col items-center p-0">
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <Avatar className="w-20 h-20 mb-2 border-4 border-white/30 bg-gray-900">
            <AvatarFallback className="text-4xl">⚙️</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Settings
          </h1>
          <p className="text-base text-gray-200 font-medium">
            Manage your account, integrations, and preferences
          </p>
        </div>
        <Separator className="bg-gray-700 my-2" />
        <ScrollArea className="w-full px-4 pb-4 max-h-[70vh]">
          <div className="space-y-8">
            {/* Account Section */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Account</h2>
              <div className="flex items-center justify-between bg-gray-800/80 rounded-lg p-4 mb-2">
                <div>
                  {profile && (
                    <>
                      <p className="text-sm font-medium text-white">Name</p>
                      <p className="text-sm text-gray-400 mb-1">
                        {profile.first_name} {profile.last_name}
                      </p>
                    </>
                  )}
                  <p className="text-sm font-medium text-white">Email</p>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                </div>
                <Button
                  onClick={handleSignOut}
                  size="sm"
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </div>
            </div>
            {/* Integrations Section */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Integrations
              </h2>
              <div className="space-y-3">
                {integrationsItems.map((integration) => {
                  const Icon = integration.icon;
                  const connected = isConnected(integration.id);
                  return (
                    <div
                      key={integration.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        connected
                          ? "bg-green-900/20 border-green-500/30"
                          : "bg-gray-800/80 border-gray-700"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-md bg-gray-700 flex items-center justify-center">
                          <Icon size={20} className={integration.color} />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-white">
                            {integration.name}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {integration.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {connected ? (
                          <>
                            <CheckCircle size={18} className="text-green-500" />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDisconnect(integration.id)}
                              className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} className="text-red-500" />
                            <Button
                              size="sm"
                              onClick={() => handleConnect(integration.id)}
                              disabled={loading}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Connect
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Custom Instructions Section */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Chief's Instructions
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Provide specific instructions to customize how Chief responds to
                you. For example, mention your role, preferences, or specific
                contexts you want Chief to consider.
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
            {/* Voice Settings Section (placeholder) */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Voice Settings
              </h2>
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
        </ScrollArea>
      </Card>
    </div>
  );
};

export default SettingsPage;
