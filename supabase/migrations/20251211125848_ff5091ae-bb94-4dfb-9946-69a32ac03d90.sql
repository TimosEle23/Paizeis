-- The rate_limit_attempts table intentionally has no public policies
-- It's only accessed via service role from edge functions
-- Adding a comment policy to satisfy the linter while keeping it secure

-- This is a no-op policy that documents the intentional design
COMMENT ON TABLE public.rate_limit_attempts IS 'Rate limiting table - no RLS policies intentionally. Only accessible via service role from edge functions for security.';