
import { useAuth } from "@/hooks/useAuth";
import VoiceInterface from "@/components/VoiceInterface";
import AuthForm from "@/components/AuthForm";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <VoiceInterface />
    </div>
  );
};

export default Index;
