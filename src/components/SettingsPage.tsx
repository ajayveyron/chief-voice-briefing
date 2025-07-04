import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import PrivacyNotification from "@/components/PrivacyNotification";

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
  avatar_url?: string;
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

      // Fetch basic profile data (columns that definitely exist)
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          avatar_url: user?.user_metadata?.picture || null, // Use Google profile pic from OAuth
        });
      } else {
        // Fallback to user metadata if profile doesn't exist
        if (user?.user_metadata) {
          const fullName =
            user.user_metadata.full_name || user.user_metadata.name || "";
          const nameParts = fullName.split(" ");
          setProfile({
            first_name: nameParts[0] || "",
            last_name: nameParts.slice(1).join(" ") || "",
            avatar_url: user.user_metadata.picture || null,
          });
        }
      }
    };
    fetchProfile();
  }, [user?.id, user?.user_metadata]);

  // Log access token when settings page loads
  useEffect(() => {
    const logAccessToken = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) {
        console.log("🔑 Access Token:", sessionData.session.access_token);
        console.log("👤 User ID:", user?.id);
        console.log("📧 User Email:", user?.email);
      } else {
        console.log("❌ No access token found");
      }
    };
    logAccessToken();
  }, [user?.id, user?.email]);

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
      // Show privacy notification for Google integrations
      if (type === "gmail" || type === "calendar") {
        // You can add a modal here if you want to show the privacy notice before connecting
        // For now, we'll just proceed with the connection
        console.log(
          "Connecting Google integration - privacy notice shown in banner"
        );
      }

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

  // Get user initials for fallback avatar
  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name.charAt(0)}${profile.last_name.charAt(
        0
      )}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <div className="min-h-screen bg-[#3b4b5e] text-white p-6">
      <div className="max-w-md mx-auto bg-[#2e3845] rounded-2xl shadow-xl">
        {/* Profile Section */}
        <div className="px-6 pt-8 pb-6 text-center">
          <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-gray-600">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt="Profile" />
            ) : (
              <AvatarFallback className="bg-gray-600 text-white text-lg font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            )}
          </Avatar>

          <h2 className="text-xl font-semibold mb-1">
            {profile
              ? `${profile.first_name} ${profile.last_name}`
              : "Full Name"}
          </h2>

          <div className="flex items-center justify-center gap-2 text-gray-300">
            <span>{user?.email || "Email@email.com"}</span>
            <button
              onClick={handleSignOut}
              className="ml-2 p-1 rounded hover:bg-gray-600 transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} className="text-red-400" />
            </button>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="px-6 pb-6">
          <h3 className="text-lg font-semibold mb-4">Integrations</h3>

          <div className="space-y-3">
            {integrationsItems.map((integration) => {
              const Icon = integration.icon;
              const connected = isConnected(integration.id);

              return (
                <div
                  key={integration.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    connected
                      ? "bg-[#1a2a1a] border-green-600"
                      : "bg-[#252e3a] border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                      <Icon size={20} className={integration.color} />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">
                        {integration.name}
                      </h4>
                      <p className="text-sm text-gray-400">
                        {integration.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {connected ? (
                      <>
                        <CheckCircle size={16} className="text-green-500" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnect(integration.id)}
                          className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white text-xs px-3 py-1"
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} className="text-red-500" />
                        <Button
                          size="sm"
                          onClick={() => handleConnect(integration.id)}
                          disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
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

        {/* Privacy & Data Usage Section */}
        <div className="px-6 pb-6">
          <PrivacyNotification variant="settings" />
        </div>

        {/* Chief's Instructions Section */}
        <div className="px-6 pb-8">
          <h3 className="text-lg font-semibold mb-2">Chief's Instructions</h3>
          <p className="text-sm text-gray-400 mb-4">
            Provide specific instructions to customize how Chief responds to
            you. For example, mention your role, preferences, or specific
            contexts you want Chief to consider.
          </p>

          <Textarea
            placeholder="Enter your custom instructions here... For example: 'I'm a software engineer working on web applications."
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            className="min-h-[100px] bg-[#252e3a] border-gray-600 text-white placeholder-gray-500 resize-none"
          />

          <Button
            onClick={handleSaveInstructions}
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            Save Instructions
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
