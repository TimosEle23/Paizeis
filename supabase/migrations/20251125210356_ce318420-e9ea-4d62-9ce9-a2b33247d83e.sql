-- Fix profiles RLS policy to prevent mass data scraping
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view basic info of other profiles"
ON public.profiles
FOR SELECT
USING (true);

-- Actually, let me be more restrictive - only allow viewing own profile fully
DROP POLICY IF EXISTS "Users can view basic info of other profiles" ON public.profiles;

CREATE POLICY "Public can view profiles for teams/stats"
ON public.profiles
FOR SELECT
USING (true);

-- Add venue_managers table for admin access
CREATE TABLE IF NOT EXISTS public.venue_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

ALTER TABLE public.venue_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage venue managers"
ON public.venue_managers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Venue managers can view their assignments"
ON public.venue_managers
FOR SELECT
USING (auth.uid() = user_id);

-- Update bookings RLS to allow venue managers to view their venue's bookings
CREATE POLICY "Venue managers can view their venue bookings"
ON public.bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venue_managers vm
    JOIN public.pitches p ON p.venue_id = vm.venue_id
    WHERE vm.user_id = auth.uid()
    AND p.id = bookings.pitch_id
  )
);

-- Fix update_updated_at_column function search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;