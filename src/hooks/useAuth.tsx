import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// Helper to upsert profile for OAuth users
async function upsertOAuthProfile(user: User) {
  try {
    console.log("Creating OAuth profile for user:", user.id);
    console.log("User metadata:", user.user_metadata);

    // Extract name from user metadata
    const fullName =
      user.user_metadata?.full_name || user.user_metadata?.name || "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Extract profile picture from user metadata (Google OAuth provides this)
    const avatarUrl =
      user.user_metadata?.picture || user.user_metadata?.avatar_url || null;

    console.log("Extracted profile data:", { firstName, lastName, avatarUrl });

    const { data, error } = await supabase.from("profiles").upsert([
      {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("Profile upsert error:", error);
    } else {
      console.log("Profile created successfully:", data);
    }
  } catch (error) {
    console.error("OAuth profile creation error:", error);
  }
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Handle OAuth sign-in profile creation
      if (event === "SIGNED_IN" && session?.user) {
        // Check if this is an OAuth provider (Google, etc.)
        const isOAuth = session.user.app_metadata?.provider !== "email";
        if (isOAuth) {
          setTimeout(() => {
            upsertOAuthProfile(session.user);
          }, 0);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signOut };
};
