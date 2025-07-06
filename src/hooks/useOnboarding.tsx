import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface OnboardingStep1Data {
  preferredAddress: 'firstName' | 'Sir' | 'Madam' | 'custom';
  customAddress?: string;
  pronouns: string;
  wakeUpTime: string;
}

export interface OnboardingData {
  step1: OnboardingStep1Data;
  step2: {
    gmailConnected: boolean;
    calendarConnected: boolean;
    slackConnected: boolean;
    notionConnected: boolean;
  };
  step3: {
    dataFetchProgress: number;
    analysisProgress: number;
    embeddingProgress: number;
    completed: boolean;
  };
}

export const useOnboarding = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    step1: {
      preferredAddress: 'firstName',
      pronouns: 'He/Him',
      wakeUpTime: '09:00'
    },
    step2: {
      gmailConnected: false,
      calendarConnected: false,
      slackConnected: false,
      notionConnected: false
    },
    step3: {
      dataFetchProgress: 0,
      analysisProgress: 0,
      embeddingProgress: 0,
      completed: false
    }
  });

  // Check onboarding status with cache busting
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        console.log("Checking onboarding status for user:", user.id);
        
        // Add cache busting to ensure fresh data
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_completed, preferred_address, custom_address, pronouns, wake_up_time")
          .eq("user_id", user.id)
          .single();

        console.log("Fresh profile data from database:", profile);
        console.log("Query error:", error);

        if (error && error.code !== "PGRST116") {
          console.error("Error checking onboarding status:", error);
          setLoading(false);
          return;
        }

        const isCompleted = profile?.onboarding_completed === true;
        console.log("Onboarding completed status (strict check):", isCompleted);

        if (isCompleted) {
          console.log("✅ Setting onboarding as completed");
          setIsOnboardingCompleted(true);
        } else {
          console.log("❌ Onboarding not completed, will show onboarding flow");
          setIsOnboardingCompleted(false);
          
          // Pre-populate step 1 data if profile exists
          if (profile) {
            setOnboardingData(prev => ({
              ...prev,
              step1: {
                preferredAddress: profile.preferred_address as any || 'firstName',
                customAddress: profile.custom_address || '',
                pronouns: profile.pronouns || 'He/Him',
                wakeUpTime: profile.wake_up_time || '09:00'
              }
            }));
          }
        }
      } catch (error) {
        console.error("Error checking onboarding:", error);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user?.id]);

  const updateStep1Data = (data: OnboardingStep1Data) => {
    setOnboardingData(prev => ({
      ...prev,
      step1: data
    }));
  };

  const saveStep1 = async (data: OnboardingStep1Data) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          preferred_address: data.preferredAddress,
          custom_address: data.customAddress,
          pronouns: data.pronouns,
          wake_up_time: data.wakeUpTime
        })
        .eq("user_id", user.id);

      if (error) throw error;
      
      updateStep1Data(data);
      return true;
    } catch (error) {
      console.error("Error saving step 1:", error);
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const completeOnboarding = async () => {
    if (!user?.id) return false;

    try {
      console.log("Completing onboarding for user:", user.id);
      
      // Force the update using upsert to ensure it works
      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .upsert([{ 
          user_id: user.id,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'user_id'
        })
        .select();

      console.log("Upsert result:", { updateData, updateError });

      if (updateError) {
        console.error("Database error completing onboarding:", updateError);
        throw updateError;
      }
      
      // Wait a moment and verify
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { data: verifyData, error: verifyError } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .single();

      console.log("Verification after update:", { verifyData, verifyError });
      
      if (verifyData?.onboarding_completed === true) {
        console.log("Onboarding completion verified successfully");
        setIsOnboardingCompleted(true);
        return true;
      } else {
        console.error("Onboarding completion verification failed - value:", verifyData?.onboarding_completed);
        return false;
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
      return false;
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return {
    currentStep,
    setCurrentStep,
    isOnboardingCompleted,
    loading,
    onboardingData,
    updateStep1Data,
    saveStep1,
    completeOnboarding,
    nextStep,
    prevStep
  };
};