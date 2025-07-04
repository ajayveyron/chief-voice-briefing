-- Add profile image support to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create an index for faster lookups if needed
CREATE INDEX IF NOT EXISTS idx_profiles_avatar ON profiles(avatar_url) WHERE avatar_url IS NOT NULL; 