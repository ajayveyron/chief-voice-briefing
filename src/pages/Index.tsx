
import { useAuth } from "@/hooks/useAuth";
import AuthForm from "@/components/AuthForm";
import SimpleChatPage from "@/components/SimpleChatPage";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <SimpleChatPage />;
};

export default Index;
