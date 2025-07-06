import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OnboardingStep3Props {
  onComplete: () => void;
  loading?: boolean;
}

interface AnalysisStats {
  totalEmails: number;
  contactsExtracted: number;
  preferencesAnalyzed: {
    writingStyle: string;
    tone: string;
    commonTopics: string[];
  };
}

const OnboardingStep3 = ({ onComplete, loading = false }: OnboardingStep3Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [isProcessing, setIsProcessing] = useState(true);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [completed, setCompleted] = useState(false);

  const userName = user?.user_metadata?.full_name?.split(" ")[0] || 
                   user?.user_metadata?.first_name || 
                   user?.email?.split("@")[0] || 
                   "User";

  useEffect(() => {
    if (isProcessing) {
      startDataAnalysis();
    }
  }, [isProcessing]);

  const startDataAnalysis = async () => {
    try {
      // Step 1: Fetch Gmail data
      setCurrentTask("Fetching your emails...");
      setProgress(10);
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      // Step 2: Analyze email patterns
      setCurrentTask("Analyzing your communication patterns...");
      setProgress(35);
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Step 3: Extract contacts
      setCurrentTask("Extracting your frequent contacts...");
      setProgress(60);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Create embeddings
      setCurrentTask("Creating intelligent embeddings for quick access...");
      setProgress(85);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 5: Finalize
      setCurrentTask("Finalizing your personalized Chief setup...");
      setProgress(100);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock analysis results
      setAnalysisStats({
        totalEmails: 247,
        contactsExtracted: 23,
        preferencesAnalyzed: {
          writingStyle: "Professional with friendly tone",
          tone: "Collaborative and direct",
          commonTopics: ["Project updates", "Meeting scheduling", "Technical discussions"]
        }
      });
      
      setCompleted(true);
      setIsProcessing(false);
      
    } catch (error) {
      console.error("Error during data analysis:", error);
      toast({
        title: "Analysis Error",
        description: "There was an issue analyzing your data. You can continue and set this up later.",
        variant: "destructive"
      });
      setCompleted(true);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black/50 backdrop-blur-lg border-white/20">
        <CardHeader className="text-center">
          <div className="text-sm text-gray-400 mb-2">Step 3</div>
          <CardTitle className="text-2xl font-bold text-white">Good Morning {userName}</CardTitle>
          <CardDescription className="text-gray-300">
            {completed 
              ? "Your Chief is ready! Here's what I learned about you."
              : "Allow me some time to better understand your work life and day to day responsibilities."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!completed ? (
            <div className="space-y-6">
              {/* Progress Circle */}
              <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-700"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-blue-500"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${progress}, 100`}
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
                  </div>
                </div>
              </div>
              
              {/* Current Task */}
              <div className="text-center">
                <p className="text-white text-lg font-medium mb-2">{currentTask}</p>
                <Progress value={progress} className="w-full" />
              </div>
              
              {/* Status Messages */}
              <div className="space-y-2 text-sm text-gray-400">
                <div className={`flex items-center space-x-2 ${progress >= 10 ? 'text-green-400' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progress >= 10 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                  <span>Fetching integration data</span>
                </div>
                <div className={`flex items-center space-x-2 ${progress >= 35 ? 'text-green-400' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progress >= 35 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                  <span>Analyzing communication patterns</span>
                </div>
                <div className={`flex items-center space-x-2 ${progress >= 60 ? 'text-green-400' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progress >= 60 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                  <span>Extracting contacts and preferences</span>
                </div>
                <div className={`flex items-center space-x-2 ${progress >= 85 ? 'text-green-400' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progress >= 85 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                  <span>Creating intelligent embeddings</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="text-white font-medium">I'll send you a notification as soon as I am ready.</p>
              </div>
              
              {/* Analysis Results */}
              {analysisStats && (
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                  <h3 className="text-white font-medium">Analysis Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Emails Analyzed:</span>
                      <div className="text-white font-medium">{analysisStats.totalEmails}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Contacts Found:</span>
                      <div className="text-white font-medium">{analysisStats.contactsExtracted}</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Communication Style:</span>
                    <div className="text-white text-sm">{analysisStats.preferencesAnalyzed.writingStyle}</div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Common Topics:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysisStats.preferencesAnalyzed.commonTopics.map((topic, index) => (
                        <span key={index} className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <Button
                onClick={onComplete}
                disabled={loading}
                className="w-full h-14 bg-white text-black hover:bg-gray-100 text-lg font-medium"
              >
                {loading ? "Setting up..." : "Get Started with Chief"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingStep3;