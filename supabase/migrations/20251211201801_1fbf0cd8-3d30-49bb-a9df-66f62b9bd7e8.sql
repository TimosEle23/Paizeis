-- Table for pending email invitations (for non-registered users)
CREATE TABLE public.email_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('team', 'booking', 'tournament')),
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.email_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view invitations by email" ON public.email_invitations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create invitations" ON public.email_invitations
  FOR INSERT WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Users can delete their sent invitations" ON public.email_invitations
  FOR DELETE USING (auth.uid() = invited_by);

-- Table for players looking for teams/matches
CREATE TABLE public.player_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('match', 'team')),
  position TEXT,
  message TEXT,
  city TEXT,
  available_days TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.player_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings" ON public.player_listings
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create their own listings" ON public.player_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings" ON public.player_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings" ON public.player_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_email_invitations_email ON public.email_invitations(email);
CREATE INDEX idx_player_listings_type ON public.player_listings(listing_type, is_active);