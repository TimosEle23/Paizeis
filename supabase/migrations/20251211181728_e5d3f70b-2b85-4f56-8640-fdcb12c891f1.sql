-- Fix 1: Add UPDATE policy for venue managers to modify bookings on their assigned venues
CREATE POLICY "Venue managers can update their venue bookings" 
ON public.bookings 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM venue_managers vm
    JOIN pitches p ON p.venue_id = vm.venue_id
    WHERE vm.user_id = auth.uid() 
    AND p.id = bookings.pitch_id
  )
);

-- Fix 2: Add admin SELECT policy to rate_limit_attempts table for security monitoring
CREATE POLICY "Admins can view rate limit attempts" 
ON public.rate_limit_attempts 
FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role));