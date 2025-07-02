-- Fix service role policies for analyze-gmail function
-- This migration ensures the service role can properly insert/update data

-- Drop existing service role policies if they exist
DROP POLICY IF EXISTS "Service role can manage preferences" ON user_preferences;
DROP POLICY IF EXISTS "Service role can manage contacts" ON contacts;

-- Create more permissive policies for service role
CREATE POLICY "Service role can manage preferences" ON user_preferences
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage contacts" ON contacts
  FOR ALL USING (auth.role() = 'service_role');

-- Also allow service role to delete contacts (needed for cleanup)
CREATE POLICY "Service role can delete contacts" ON contacts
  FOR DELETE USING (auth.role() = 'service_role');

-- Grant necessary permissions to service role
GRANT ALL ON user_preferences TO service_role;
GRANT ALL ON contacts TO service_role;

-- Create a function to test database connectivity
CREATE OR REPLACE FUNCTION test_db_connection()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'Database connection successful';
END;
$$;

-- Add a function to safely insert contacts with better error handling
CREATE OR REPLACE FUNCTION insert_contacts_safe(
  p_user_id UUID,
  p_contacts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  contact_record JSONB;
  inserted_count INTEGER := 0;
  error_count INTEGER := 0;
  result JSONB;
BEGIN
  -- First, delete existing contacts for this user
  DELETE FROM contacts WHERE user_id = p_user_id;
  
  -- Insert new contacts
  FOR contact_record IN SELECT * FROM jsonb_array_elements(p_contacts)
  LOOP
    BEGIN
      INSERT INTO contacts (
        user_id,
        name,
        email,
        role,
        company,
        context,
        frequency,
        updated_at
      ) VALUES (
        p_user_id,
        contact_record->>'name',
        contact_record->>'email',
        contact_record->>'role',
        contact_record->>'company',
        contact_record->>'context',
        COALESCE((contact_record->>'frequency')::INTEGER, 1),
        NOW()
      );
      inserted_count := inserted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE NOTICE 'Error inserting contact: %', SQLERRM;
    END;
  END LOOP;
  
  result := jsonb_build_object(
    'inserted_count', inserted_count,
    'error_count', error_count,
    'total_contacts', jsonb_array_length(p_contacts)
  );
  
  RETURN result;
END;
$$; 