import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Eye,
  Lock,
  CheckCircle,
  X,
  ExternalLink,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface PrivacyNotificationProps {
  onDismiss?: () => void;
  variant?: "banner" | "modal" | "settings";
}

const PrivacyNotification: React.FC<PrivacyNotificationProps> = ({
  onDismiss,
  variant = "banner",
}) => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeenNotification, setHasSeenNotification] = useState(false);

  useEffect(() => {
    // Check if user has seen the privacy notification
    const seen = localStorage.getItem(`privacy-notification-seen-${user?.id}`);
    if (!seen && user) {
      setIsVisible(true);
    }
  }, [user]);

  const handleDismiss = () => {
    setIsVisible(false);
    setHasSeenNotification(true);
    localStorage.setItem(`privacy-notification-seen-${user?.id}`, "true");
    onDismiss?.();
  };

  const handleViewPrivacyPolicy = () => {
    window.open("https://mychief.app/privacy", "_blank");
  };

  const handleViewTerms = () => {
    window.open("https://mychief.app/terms", "_blank");
  };

  if (!isVisible && variant !== "settings") {
    return null;
  }

  const privacyHighlights = [
    {
      icon: Shield,
      title: "Data Protection",
      description: "Your Google data is encrypted and stored securely",
    },
    {
      icon: Eye,
      title: "Limited Access",
      description: "We only access data needed for voice briefings",
    },
    {
      icon: Lock,
      title: "No Human Reading",
      description: "Your emails and calendar data are processed by AI only",
    },
    {
      icon: CheckCircle,
      title: "No Advertising",
      description: "We never use your data for ads or marketing",
    },
  ];

  if (variant === "banner") {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5" />
            <div>
              <p className="font-medium">Privacy & Data Usage</p>
              <p className="text-sm opacity-90">
                We access your Google data only for voice briefings.
                <button
                  onClick={handleViewPrivacyPolicy}
                  className="underline ml-1 hover:opacity-80"
                >
                  Learn more
                </button>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewPrivacyPolicy}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Privacy Policy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Privacy & Data Usage Notice
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">
                  How We Use Your Google Data
                </h3>
                <p className="text-gray-600">
                  Chief accesses your Gmail and Calendar data to provide voice
                  briefings and insights. Here's how we protect your privacy:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {privacyHighlights.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <Icon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <p className="text-xs text-gray-600">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Google Data We Access:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Gmail
                    </Badge>
                    <span>
                      Email content, metadata, and drafts for voice summaries
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Calendar
                    </Badge>
                    <span>
                      Events, meetings, and schedules for daily briefings
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-1">
                      Limited Use Compliance
                    </p>
                    <p className="text-blue-700">
                      We strictly follow Google's Limited Use requirements. Your
                      data is used only for providing voice briefings and
                      improving our service. We never sell, advertise, or share
                      your data with third parties.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleViewPrivacyPolicy}
                  className="flex-1"
                  variant="outline"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Privacy Policy
                </Button>
                <Button
                  onClick={handleViewTerms}
                  className="flex-1"
                  variant="outline"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Terms & Conditions
                </Button>
                <Button onClick={handleDismiss} className="flex-1">
                  I Understand
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Settings variant
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          Privacy & Data Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">
                How We Use Your Data
              </p>
              <p className="text-blue-700">
                Chief accesses your Google data (Gmail & Calendar) exclusively
                to provide voice briefings and insights. We follow Google's
                Limited Use requirements and never use your data for advertising
                or share it with third parties.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {privacyHighlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <Icon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-sm">{item.title}</h4>
                  <p className="text-xs text-gray-600">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleViewPrivacyPolicy}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Privacy Policy
          </Button>
          <Button
            onClick={handleViewTerms}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Terms & Conditions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacyNotification;
