
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface AuthFormProps {
  onAuthSuccess: () => void;
}

const AuthForm = ({ onAuthSuccess }: AuthFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Welcome back!",
          description: "Successfully signed in.",
        });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      }
      onAuthSuccess();
    } catch (error: any) {
      toast({
        title: "Authentication error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    setLoading(true);
    try {
      // Create or sign in with a demo account
      const demoEmail = "demo@chief.app";
      const demoPassword = "demo123456";
      
      // Try to sign in first, if it fails, create the account
      let { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error) {
        // Account doesn't exist, create it
        const { error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
        });
        
        if (signUpError) throw signUpError;
        
        // Try to sign in again
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        
        if (signInError) throw signInError;
      }

      toast({
        title: "Demo Mode Active",
        description: "You're now signed in as a demo user.",
      });
      onAuthSuccess();
    } catch (error: any) {
      toast({
        title: "Demo mode error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-light mb-2">Chief</h1>
          <p className="text-gray-400">Your AI assistant for staying updated</p>
        </div>

        {/* Demo Mode Button */}
        <button
          onClick={handleDemoMode}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors mb-6"
        >
          {loading ? "Loading..." : "🚀 Try Demo Mode"}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-black px-2 text-gray-500">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
