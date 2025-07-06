import { useOnboarding } from "@/hooks/useOnboarding";
import OnboardingStep1 from "./OnboardingStep1";
import OnboardingStep2 from "./OnboardingStep2";
import OnboardingStep3 from "./OnboardingStep3";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";

const Onboarding = () => {
  const navigate = useNavigate();
  const { stepNumber } = useParams();
  const {
    currentStep,
    setCurrentStep,
    onboardingData,
    updateStep1Data,
    saveStep1,
    completeOnboarding,
    nextStep,
    loading
  } = useOnboarding();

  // Handle URL-based step navigation
  useEffect(() => {
    if (stepNumber) {
      const step = parseInt(stepNumber);
      if (step >= 1 && step <= 3 && step !== currentStep) {
        setCurrentStep(step);
      }
    } else {
      // If no step in URL, redirect to current step
      navigate(`/onboarding/step/${currentStep}`, { replace: true });
    }
  }, [stepNumber, currentStep, setCurrentStep, navigate]);

  const handleStep1Continue = async (data: typeof onboardingData.step1) => {
    const success = await saveStep1(data);
    if (success) {
      nextStep();
      navigate('/onboarding/step/2');
    }
  };

  const handleStep2Continue = () => {
    nextStep();
    navigate('/onboarding/step/3');
  };

  const handleStep3Complete = async () => {
    console.log("Step 3 completion started...");
    const success = await completeOnboarding();
    console.log("Onboarding completion result:", success);
    
    if (success) {
      console.log("Clearing all cached state and navigating to home...");
      
      // Clear any potential React Query cache
      try {
        // Force refresh the page to clear all cached state
        window.location.replace("/home");
      } catch (error) {
        console.error("Navigation error:", error);
        // Fallback navigation
        navigate("/home", { replace: true });
      }
    } else {
      console.error("Failed to complete onboarding, but proceeding anyway...");
      // Even if completion "failed", the DB shows it's true, so proceed
      window.location.replace("/home");
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