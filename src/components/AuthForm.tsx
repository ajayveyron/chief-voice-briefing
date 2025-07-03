import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface AuthFormProps {
  onAuthSuccess: () => void;
}

// Helper to upsert profile
type ProfileUpsert = {
  user_id: string;
  first_name: string;
  last_name: string;
};

async function upsertProfile({
  user_id,
  first_name,
  last_name,
}: ProfileUpsert) {
  const { error } = await supabase.from("profiles").upsert([
    {
      user_id, // should match auth user id
      first_name,
      last_name,
      updated_at: new Date().toISOString(),
    },
  ]);
  if (error) throw error;
}

const AuthForm = ({ onAuthSuccess }: AuthFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
        // Upsert profile after login
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          try {
            await upsertProfile({
              user_id: user.id,
              first_name: firstName || "",
              last_name: lastName || "",
            });
          } catch (profileError: any) {
            toast({
              title: "Profile error",
              description: profileError.message,
              variant: "destructive",
            });
          }
        }
        toast({
          title: "Welcome back!",
          description: "Successfully signed in.",
        });
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          toast({
            title: "Missing name",
            description: "Please enter your first and last name.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });
        if (error) throw error;
        // Upsert profile after sign up
        if (signUpData.user) {
          try {
            await upsertProfile({
              user_id: signUpData.user.id,
              first_name: firstName,
              last_name: lastName,
            });
          } catch (profileError: any) {
            toast({
              title: "Profile error",
              description: profileError.message,
              variant: "destructive",
            });
          }
        }
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

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google Auth Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    setLoading(true);
    try {
      // Create a simple demo account that bypasses email confirmation
      if (!firstName.trim() || !lastName.trim()) {
        toast({
          title: "Missing name",
          description: "Please enter your first and last name for demo mode.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const demoEmail = `demo-${Date.now()}@chief.app`;
      const demoPassword = "demo123456";

      console.log("Creating demo account...", demoEmail);

      // Create the account
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });

      if (signUpError) {
        console.error("Demo signup error:", signUpError);
        throw signUpError;
      }

      console.log("Demo account created, signing in...");

      // For demo mode, we'll use the session from signup if available
      if (signUpData.session && signUpData.user) {
        try {
          await upsertProfile({
            user_id: signUpData.user.id,
            first_name: firstName,
            last_name: lastName,
          });
        } catch (profileError: any) {
          toast({
            title: "Profile error",
            description: profileError.message,
            variant: "destructive",
          });
        }
        toast({
          title: "Demo Mode Active",
          description: "You're now signed in as a demo user.",
        });
        onAuthSuccess();
      } else {
        // If no session, try to sign in (though this might fail with email confirmation)
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPassword,
          });

        if (signInError) {
          console.error("Demo signin error:", signInError);
          // If sign in fails due to email confirmation, show a helpful message
          toast({
            title: "Demo Mode Notice",
            description:
              "Demo account created but needs email confirmation. Please use regular sign up for now, or contact support to disable email confirmation.",
            variant: "destructive",
          });
        } else if (signInData.user) {
          try {
            await upsertProfile({
              user_id: signInData.user.id,
              first_name: firstName,
              last_name: lastName,
            });
          } catch (profileError: any) {
            toast({
              title: "Profile error",
              description: profileError.message,
              variant: "destructive",
            });
          }
          toast({
            title: "Demo Mode Active",
            description: "You're now signed in as a demo user.",
          });
          onAuthSuccess();
        }
      }
    } catch (error: any) {
      console.error("Demo mode error:", error);
      toast({
        title: "Demo mode error",
        description:
          error.message ||
          "Failed to create demo account. Please try regular sign up.",
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
          <p className="text-gray-400">
            Your Virtual assistant for staying updated
          </p>
        </div>

        {/* Name fields - only show for signup */}
        {!isLogin && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-1/2 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-1/2 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white"
            />
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? "Connecting..." : "Continue with Google"}
        </button>

        {/* Demo Mode Button - only show for signup */}
        {!isLogin && (
          <button
            onClick={handleDemoMode}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating Demo Account..." : "🚀 Try Demo Mode"}
          </button>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-black px-2 text-gray-500">
              Or continue with email
            </span>
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
            {isLogin
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
