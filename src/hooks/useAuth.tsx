import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// Helper to upsert profile for all users
async function upsertUserProfile(user: User) {
  try {
    console.log("Creating/updating profile for user:", user.id);
    console.log("User metadata:", user.user_metadata);

    // Extract name from user metadata
    const fullName =
      user.user_metadata?.full_name || user.user_metadata?.name || "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || user.user_metadata?.first_name || "";
    const lastName = nameParts.slice(1).join(" ") || user.user_metadata?.last_name || "";

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
    console.error("Profile creation error:", error);
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

      // Handle profile creation for all signed-in users
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => {
          upsertUserProfile(session.user);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signOut };
};
