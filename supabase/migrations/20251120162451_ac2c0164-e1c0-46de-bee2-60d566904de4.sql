-- Add contact info to venues table
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS booking_method TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add available pitch types to pitches table
ALTER TABLE public.pitches
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS features TEXT[];

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for avatar uploads
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create team_roster table for fixed team members
CREATE TABLE IF NOT EXISTS public.team_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position TEXT,
  is_captain BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view team rosters"
ON public.team_roster
FOR SELECT
USING (true);

CREATE POLICY "Team captains can manage roster"
ON public.team_roster
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = team_roster.team_id
    AND teams.captain_id = auth.uid()
  )
);

-- Create substitute_players table to track substitute usage
CREATE TABLE IF NOT EXISTS public.substitute_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  substitute_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  match_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.substitute_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view substitute records"
ON public.substitute_players
FOR SELECT
USING (true);

CREATE POLICY "Team captains can add substitutes"
ON public.substitute_players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = substitute_team_id
    AND teams.captain_id = auth.uid()
  )
);

-- Create function to check monthly substitute limit
CREATE OR REPLACE FUNCTION public.check_substitute_limit(
  _user_id UUID,
  _team_id UUID,
  _month_start DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.substitute_players
  WHERE user_id = _user_id
    AND substitute_team_id = _team_id
    AND match_date >= _month_start
    AND match_date < (_month_start + INTERVAL '1 month')::DATE
$$;

-- Create match_stats table for tracking individual match performance
CREATE TABLE IF NOT EXISTS public.match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  clean_sheet BOOLEAN DEFAULT false,
  match_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view match stats"
ON public.match_stats
FOR SELECT
USING (true);

CREATE POLICY "Team captains can manage match stats"
ON public.match_stats
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = match_stats.team_id
    AND teams.captain_id = auth.uid()
  )
);

-- Add trigger for match_stats updated_at
CREATE TRIGGER update_match_stats_updated_at
BEFORE UPDATE ON public.match_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();