import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import type { OnboardingStep1Data } from "@/hooks/useOnboarding";

interface OnboardingStep1Props {
  data: OnboardingStep1Data;
  onUpdate: (data: OnboardingStep1Data) => void;
  onContinue: (data: OnboardingStep1Data) => Promise<void>;
  loading?: boolean;
}

const OnboardingStep1 = ({ data, onUpdate, onContinue, loading = false }: OnboardingStep1Props) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<OnboardingStep1Data>(data);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userName = user?.user_metadata?.full_name?.split(" ")[0] || 
                   user?.user_metadata?.first_name || 
                   user?.email?.split("@")[0] || 
                   "User";

  useEffect(() => {
    setFormData(data);
  }, [data]);

  const handleAddressChange = (address: OnboardingStep1Data['preferredAddress']) => {
    const newData = { ...formData, preferredAddress: address };
    if (address !== 'custom') {
      newData.customAddress = '';
    }
    setFormData(newData);
    onUpdate(newData);
  };

  const handlePronounsChange = (pronouns: string) => {
    const newData = { ...formData, pronouns };
    setFormData(newData);
    onUpdate(newData);
  };

  const handleCustomAddressChange = (customAddress: string) => {
    const newData = { ...formData, customAddress };
    setFormData(newData);
    onUpdate(newData);
  };

  const handleTimeChange = (wakeUpTime: string) => {
    const newData = { ...formData, wakeUpTime };
    setFormData(newData);
    onUpdate(newData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onContinue(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.preferredAddress === 'custom' 
    ? formData.customAddress?.trim() 
    : true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black/50 backdrop-blur-lg border-white/20">
        <CardHeader className="text-center">
          <div className="text-sm text-gray-400 mb-2">Step 1</div>
          <CardTitle className="text-2xl font-bold text-white">Hi {userName}</CardTitle>
          <CardDescription className="text-gray-300">
            I am eager to learn more about you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Address Preference */}
            <div className="space-y-3">
              <Label className="text-white text-base">What should I call you?</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={formData.preferredAddress === 'firstName' ? "default" : "outline"}
                  className={`h-12 text-sm ${
                    formData.preferredAddress === 'firstName' 
                      ? "bg-white text-black" 
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={() => handleAddressChange('firstName')}
                >
                  {userName}
                </Button>
                <Button
                  type="button"
                  variant={formData.preferredAddress === 'Sir' ? "default" : "outline"}
                  className={`h-12 text-sm ${
                    formData.preferredAddress === 'Sir' 
                      ? "bg-white text-black" 
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={() => handleAddressChange('Sir')}
                >
                  Sir
                </Button>
                <Button
                  type="button"
                  variant={formData.preferredAddress === 'Madam' ? "default" : "outline"}
                  className={`h-12 text-sm ${
                    formData.preferredAddress === 'Madam' 
                      ? "bg-white text-black" 
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={() => handleAddressChange('Madam')}
                >
                  Madam
                </Button>
                <Button
                  type="button"
                  variant={formData.preferredAddress === 'custom' ? "default" : "outline"}
                  className={`h-12 text-sm ${
                    formData.preferredAddress === 'custom' 
                      ? "bg-white text-black" 
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={() => handleAddressChange('custom')}
                >
                  ✏️ Custom
                </Button>
              </div>
              {formData.preferredAddress === 'custom' && (
                <Input
                  placeholder="Enter custom address"
                  value={formData.customAddress || ''}
                  onChange={(e) => handleCustomAddressChange(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
              )}
            </div>

            {/* Pronouns */}
            <div className="space-y-3">
              <Label className="text-white text-base">What are your pronouns?</Label>
              <div className="grid grid-cols-2 gap-2">
                {['He/Him', 'She/Her', 'They/Them'].map((pronoun) => (
                  <Button
                    key={pronoun}
                    type="button"
                    variant={formData.pronouns === pronoun ? "default" : "outline"}
                    className={`h-12 text-sm ${
                      formData.pronouns === pronoun 
                        ? "bg-white text-black" 
                        : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                    }`}
                    onClick={() => handlePronounsChange(pronoun)}
                  >
                    {pronoun}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={!['He/Him', 'She/Her', 'They/Them'].includes(formData.pronouns) ? "default" : "outline"}
                  className={`h-12 text-sm ${
                    !['He/Him', 'She/Her', 'They/Them'].includes(formData.pronouns)
                      ? "bg-white text-black" 
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={() => handlePronounsChange('Custom')}
                >
                  ✏️ Custom
                </Button>
              </div>
              {!['He/Him', 'She/Her', 'They/Them'].includes(formData.pronouns) && (
                <Input
                  placeholder="Enter your pronouns"
                  value={formData.pronouns === 'Custom' ? '' : formData.pronouns}
                  onChange={(e) => handlePronounsChange(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
              )}
            </div>

            {/* Wake Up Time */}
            <div className="space-y-3">
              <Label className="text-white text-base">When do you wake up?</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="time"
                  value={formData.wakeUpTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="bg-white/10 border-white/20 text-white text-2xl font-mono text-center"
                />
              </div>
              <p className="text-sm text-gray-400">
                This helps me properly plan out your day.
              </p>
            </div>

            <Button
              type="submit"
              disabled={!isFormValid || isSubmitting || loading}
              className="w-full h-14 bg-white text-black hover:bg-gray-100 text-lg font-medium"
            >
              {isSubmitting || loading ? "Saving..." : "Continue →"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingStep1;