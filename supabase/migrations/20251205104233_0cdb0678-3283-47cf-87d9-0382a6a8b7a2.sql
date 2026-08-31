-- Remove admin role from timos.eleftheriou@gmail.com and add to pezeiscy@gmail.com
DELETE FROM public.user_roles 
WHERE role = 'admin' 
AND user_id IN (SELECT id FROM auth.users WHERE email = 'timos.eleftheriou@gmail.com');

-- Add admin role to pezeiscy@gmail.com (if user exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users 
WHERE email = 'pezeiscy@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Create a view for venue managers to see bookings without financial data
CREATE OR REPLACE VIEW public.bookings_for_venue_managers AS
SELECT 
  b.id,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.pitch_id,
  b.team_id,
  b.user_id,
  b.status,
  b.created_at,
  b.updated_at
FROM public.bookings b;

-- Grant access to the view
GRANT SELECT ON public.bookings_for_venue_managers TO authenticated;