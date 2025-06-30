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

        {/* First Name and Last Name Fields */}
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

        {/* Demo Mode Button */}
        <button
          onClick={handleDemoMode}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors mb-6"
        >
          {loading ? "Creating Demo Account..." : "🚀 Try Demo Mode"}
        </button>

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
