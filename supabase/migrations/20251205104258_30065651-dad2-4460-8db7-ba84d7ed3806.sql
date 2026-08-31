-- Drop the security definer view
DROP VIEW IF EXISTS public.bookings_for_venue_managers;

-- Update the venue managers booking policy to exclude financial columns
-- First drop the existing policy
DROP POLICY IF EXISTS "Venue managers can view their venue bookings" ON public.bookings;

-- Create updated policy - venue managers can still see bookings but we'll handle financial data restriction in application code
CREATE POLICY "Venue managers can view their venue bookings" 
ON public.bookings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM venue_managers vm
    JOIN pitches p ON p.venue_id = vm.venue_id
    WHERE vm.user_id = auth.uid() AND p.id = bookings.pitch_id
  )
);