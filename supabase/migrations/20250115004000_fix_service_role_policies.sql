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