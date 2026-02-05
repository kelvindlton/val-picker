-- Check if the user exists in Supabase Auth but not in the users table
-- Run this in your Supabase SQL Editor

-- First, let's see what users exist in the users table
SELECT id, email, name, profile_complete, created_at 
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- If you see your email here, the user exists and login should work
-- If you don't see your email, the user profile wasn't created during registration

-- To fix: Delete the orphaned auth user and re-register
-- You can do this by going to Authentication > Users in Supabase Dashboard
-- and deleting the user, then registering again
