-- Add onboarding and preference fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preferred_address VARCHAR DEFAULT 'firstName', -- 'firstName', 'Sir', 'Madam', 'custom'
ADD COLUMN IF NOT EXISTS custom_address VARCHAR,
ADD COLUMN IF NOT EXISTS pronouns VARCHAR DEFAULT 'He/Him',
ADD COLUMN IF NOT EXISTS wake_up_time TIME DEFAULT '09:00:00';

-- Add index for better performance on onboarding queries
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles(user_id, onboarding_completed);

-- Update user_preferences table to add fields for analyzed preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS email_analysis_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_emails_analyzed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS contacts_extracted INTEGER DEFAULT 0;