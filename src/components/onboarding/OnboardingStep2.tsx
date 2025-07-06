import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useToast } from "@/hooks/use-toast";
import { Mail, Calendar, MessageSquare, FileText, CheckCircle } from "lucide-react";

interface OnboardingStep2Props {
  onContinue: () => void;
  loading?: boolean;
}

const OnboardingStep2 = ({ onContinue, loading = false }: OnboardingStep2Props) => {
  const { user } = useAuth();
  const { integrations, connectIntegration, isConnected } = useIntegrations();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState<string | null>(null);

  const userName = user?.user_metadata?.full_name?.split(" ")[0] || 
                   user?.user_metadata?.first_name || 
                   user?.email?.split("@")[0] || 
                   "User";

  const handleConnect = async (integrationType: string) => {
    setConnecting(integrationType);
    try {
      await connectIntegration(integrationType);
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Failed to connect ${integrationType}. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setConnecting(null);
    }
  };

  const requiredConnections = ['gmail', 'calendar'];
  const optionalConnections = ['slack', 'notion'];

  const areRequiredConnected = requiredConnections.every(type => isConnected(type));
  const canContinue = areRequiredConnected;

  const integrationConfig = {
    gmail: {
      icon: Mail,
      title: "Link Gmail",
      description: "It would allow me to manage your communications. Whether it is summarizing emails, replying or creating drafts.",
      required: true
    },
    calendar: {
      icon: Calendar,
      title: "Link Google Calendar", 
      description: "It would allow me to see your schedule and help you better plan out your day.",
      required: true
    },
    slack: {
      icon: MessageSquare,
      title: "Link Slack",
      description: "Connect your Slack workspace to help manage team communications and notifications.",
      required: false
    },
    notion: {
      icon: FileText,
      title: "Link Notion",
      description: "Access your Notion workspace to help organize notes, tasks, and documents.",
      required: false
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black/50 backdrop-blur-lg border-white/20">
        <CardHeader className="text-center">
          <div className="text-sm text-gray-400 mb-2">Step 2</div>
          <CardTitle className="text-2xl font-bold text-white">Alright {userName}</CardTitle>
          <CardDescription className="text-gray-300">
            Let's link some accounts so I can understand your day to day work.
          </CardDescription>
          <div className="text-sm text-gray-400 mt-2">
            Your data is fully secure and is never used without your permission.
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(integrationConfig).map(([type, config]) => {
              const Icon = config.icon;
              const connected = isConnected(type);
              const isConnecting = connecting === type;

              return (
                <div key={type} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">{config.title}</h3>
                        {config.required && (
                          <span className="text-xs text-red-400 bg-red-400/20 px-2 py-1 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {config.description}
                      </p>
                      <div className="mt-3">
                        {connected ? (
                          <div className="flex items-center space-x-2 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Connected</span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleConnect(type)}
                            disabled={isConnecting}
                            className="bg-white text-black hover:bg-gray-100 text-sm h-8 px-4"
                          >
                            {isConnecting ? "Connecting..." : "Connect"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Contacts Permission Section */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">👥</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Allow Contacts Permission</h3>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    It would allow me to understand your contact better. This helps me know who is who.
                  </p>
                  <div className="mt-3">
                    <Button
                      className="bg-white/20 border-white/20 text-white hover:bg-white/30 text-sm h-8 px-4"
                      variant="outline"
                    >
                      Allow
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={onContinue}
              disabled={!canContinue || loading}
              className="w-full h-14 bg-white text-black hover:bg-gray-100 text-lg font-medium mt-6"
            >
              {loading ? "Processing..." : "Continue →"}
            </Button>

            {!areRequiredConnected && (
              <p className="text-sm text-red-400 text-center">
                Please connect Gmail and Calendar to continue
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingStep2;