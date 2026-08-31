-- Enable RLS on venues and pitches tables (if not already enabled)
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Anyone can view venues" ON public.venues;
DROP POLICY IF EXISTS "Only admins can manage venues" ON public.venues;
DROP POLICY IF EXISTS "Anyone can view pitches" ON public.pitches;
DROP POLICY IF EXISTS "Only admins can manage pitches" ON public.pitches;

-- Create public read access for venues (everyone can view)
CREATE POLICY "Public can view all venues"
ON public.venues
FOR SELECT
TO public
USING (true);

-- Create public read access for pitches (everyone can view)
CREATE POLICY "Public can view all pitches"
ON public.pitches
FOR SELECT
TO public
USING (true);

-- Only admins can manage venues
CREATE POLICY "Admins can manage venues"
ON public.venues
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage pitches
CREATE POLICY "Admins can manage pitches"
ON public.pitches
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));