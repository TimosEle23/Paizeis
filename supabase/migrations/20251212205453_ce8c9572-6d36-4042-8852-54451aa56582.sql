-- Fix email_invitations table public exposure vulnerability
-- Drop the overly permissive policy that allows anyone to view all invitations
DROP POLICY IF EXISTS "Anyone can view invitations by email" ON public.email_invitations;

-- Create a new restrictive policy that only allows:
-- 1. The person who sent the invitation to view their sent invitations
-- 2. The recipient (by email) to view invitations sent to them
CREATE POLICY "Users can view relevant invitations" ON public.email_invitations
FOR SELECT USING (
  auth.uid() = invited_by OR 
  auth.email() = email
);