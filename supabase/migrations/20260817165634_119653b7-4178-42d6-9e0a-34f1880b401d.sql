-- 1. Scope CRM policies to authenticated role
DROP POLICY IF EXISTS "Admins can view all deals" ON public.deals;
DROP POLICY IF EXISTS "Users can create their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can view their own deals" ON public.deals;

CREATE POLICY "Admins can view all deals" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create their own deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deals" ON public.deals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own deals" ON public.deals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own deals" ON public.deals FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can create their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;

CREATE POLICY "Admins can view all invoices" ON public.invoices FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create their own invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. email_invitations: scope to authenticated + rate limit creation
DROP POLICY IF EXISTS "Authenticated users can create invitations" ON public.email_invitations;
DROP POLICY IF EXISTS "Users can delete their sent invitations" ON public.email_invitations;
DROP POLICY IF EXISTS "Users can view relevant invitations" ON public.email_invitations;

CREATE POLICY "Authenticated users can create invitations" ON public.email_invitations FOR INSERT TO authenticated WITH CHECK (auth.uid() = invited_by);
CREATE POLICY "Users can delete their sent invitations" ON public.email_invitations FOR DELETE TO authenticated USING (auth.uid() = invited_by);
CREATE POLICY "Users can view relevant invitations" ON public.email_invitations FOR SELECT TO authenticated USING ((auth.uid() = invited_by) OR (auth.email() = email));

CREATE OR REPLACE FUNCTION public.enforce_invitation_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  IF NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(NEW.email) > 254 THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.email_invitations
  WHERE invited_by = NEW.invited_by
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Invitation limit reached. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invitation_limits_trigger ON public.email_invitations;
CREATE TRIGGER enforce_invitation_limits_trigger
BEFORE INSERT ON public.email_invitations
FOR EACH ROW EXECUTE FUNCTION public.enforce_invitation_limits();

-- 3. Restrict public read access on player data tables
DROP POLICY IF EXISTS "Anyone can view match stats" ON public.match_stats;
CREATE POLICY "Authenticated users can view match stats" ON public.match_stats FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team captains can manage match stats" ON public.match_stats;
CREATE POLICY "Team captains can manage match stats" ON public.match_stats FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = match_stats.team_id AND teams.captain_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE teams.id = match_stats.team_id AND teams.captain_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active listings" ON public.player_listings;
DROP POLICY IF EXISTS "Users can create their own listings" ON public.player_listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.player_listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.player_listings;
CREATE POLICY "Authenticated users can view active listings" ON public.player_listings FOR SELECT TO authenticated USING (is_active = true OR auth.uid() = user_id);
CREATE POLICY "Users can create their own listings" ON public.player_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own listings" ON public.player_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own listings" ON public.player_listings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view substitute records" ON public.substitute_players;
CREATE POLICY "Authenticated users can view substitute records" ON public.substitute_players FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Team captains can add substitutes" ON public.substitute_players;
CREATE POLICY "Team captains can add substitutes" ON public.substitute_players FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE teams.id = substitute_players.substitute_team_id AND teams.captain_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view team rosters" ON public.team_roster;
CREATE POLICY "Authenticated users can view team rosters" ON public.team_roster FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Team captains can manage roster" ON public.team_roster;
CREATE POLICY "Team captains can manage roster" ON public.team_roster FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = team_roster.team_id AND teams.captain_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE teams.id = team_roster.team_id AND teams.captain_id = auth.uid()));

-- Remove anon grants where no anon policy remains
REVOKE ALL ON public.deals FROM anon;
REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.email_invitations FROM anon;
REVOKE ALL ON public.match_stats FROM anon;
REVOKE ALL ON public.player_listings FROM anon;
REVOKE ALL ON public.substitute_players FROM anon;
REVOKE ALL ON public.team_roster FROM anon;

-- 4. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_substitute_limit(uuid, uuid, date) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limit_attempts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_substitute_limit(uuid, uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limit_attempts() TO service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_invitation_limits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_super_admin_on_signup() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;