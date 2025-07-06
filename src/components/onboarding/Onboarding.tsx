import { useOnboarding } from "@/hooks/useOnboarding";
import OnboardingStep1 from "./OnboardingStep1";
import OnboardingStep2 from "./OnboardingStep2";
import OnboardingStep3 from "./OnboardingStep3";
import { useNavigate } from "react-router-dom";

const Onboarding = () => {
  const navigate = useNavigate();
  const {
    currentStep,
    onboardingData,
    updateStep1Data,
    saveStep1,
    completeOnboarding,
    nextStep,
    loading
  } = useOnboarding();

  const handleStep1Continue = async (data: typeof onboardingData.step1) => {
    const success = await saveStep1(data);
    if (success) {
      nextStep();
    }
  };

  const handleStep2Continue = () => {
    nextStep();
  };

  const handleStep3Complete = async () => {
    console.log("Step 3 completion started...");
    const success = await completeOnboarding();
    console.log("Onboarding completion result:", success);
    
    if (success) {
      console.log("Navigating to home...");
      // Add delay and force a refresh of the onboarding status
      setTimeout(() => {
        // Force a page reload to ensure fresh data
        window.location.href = "/home";
      }, 500);
    } else {
      console.error("Failed to complete onboarding");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  switch (currentStep) {
    case 1:
      return (
        <OnboardingStep1
          data={onboardingData.step1}
          onUpdate={updateStep1Data}
          onContinue={handleStep1Continue}
          loading={loading}
        />
      );
    case 2:
      return (
        <OnboardingStep2
          onContinue={handleStep2Continue}
          loading={loading}
        />
      );
    case 3:
      return (
        <OnboardingStep3
          onComplete={handleStep3Complete}
          loading={loading}
        />
      );
    default:
      return null;
  }
};

export default Onboarding;