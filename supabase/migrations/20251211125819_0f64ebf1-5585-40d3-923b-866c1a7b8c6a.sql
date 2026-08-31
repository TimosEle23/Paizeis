-- Fix clients table RLS policies to explicitly use 'authenticated' role
-- This provides defense-in-depth by explicitly denying anonymous access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;

-- Recreate policies with explicit 'authenticated' role
CREATE POLICY "Users can view their own clients" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients" 
ON public.clients 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients" 
ON public.clients 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients" 
ON public.clients 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all clients" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create rate_limit_attempts table for server-side rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL, -- email or IP address
    attempt_type text NOT NULL DEFAULT 'login', -- 'login', 'signup', etc.
    attempted_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_type_time 
ON public.rate_limit_attempts(identifier, attempt_type, attempted_at DESC);

-- Enable RLS on rate_limit_attempts (only edge functions with service role can access)
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access this table
-- This ensures rate limiting cannot be bypassed by clients

-- Create cleanup function to remove old attempts (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.rate_limit_attempts 
    WHERE attempted_at < now() - interval '1 hour';
END;
$$;