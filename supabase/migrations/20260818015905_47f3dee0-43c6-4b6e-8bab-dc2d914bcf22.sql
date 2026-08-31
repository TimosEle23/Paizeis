
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.captain_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.team_roster r WHERE r.team_id = _team_id AND r.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = _team_id AND m.user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION private.is_team_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_team_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.shares_team(_user_a uuid, _user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_a = _user_b OR EXISTS (
    SELECT 1
    FROM public.team_roster ra
    JOIN public.team_roster rb ON rb.team_id = ra.team_id
    WHERE ra.user_id = _user_a AND rb.user_id = _user_b
  ) OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE (t.captain_id = _user_a AND EXISTS (SELECT 1 FROM public.team_roster r WHERE r.team_id = t.id AND r.user_id = _user_b))
       OR (t.captain_id = _user_b AND EXISTS (SELECT 1 FROM public.team_roster r WHERE r.team_id = t.id AND r.user_id = _user_a))
  )
$$;
REVOKE ALL ON FUNCTION private.shares_team(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.shares_team(uuid, uuid) TO authenticated, service_role;

-- Repoint existing admin policies to private.has_role
DROP POLICY "Only admins can manage roles" ON public.user_roles;
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Users can view own roles or admin can view all" ON public.user_roles;
CREATE POLICY "Users can view own roles or admin can view all" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can view all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings" ON public.bookings FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Only admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Only admins can manage tournaments" ON public.tournaments FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Only admins can manage matches" ON public.tournament_matches;
CREATE POLICY "Only admins can manage matches" ON public.tournament_matches FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can manage venues" ON public.venues;
CREATE POLICY "Admins can manage venues" ON public.venues FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can manage pitches" ON public.pitches;
CREATE POLICY "Admins can manage pitches" ON public.pitches FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can manage venue managers" ON public.venue_managers;
CREATE POLICY "Admins can manage venue managers" ON public.venue_managers FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can view all clients" ON public.clients;
CREATE POLICY "Admins can view all clients" ON public.clients FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can view rate limit attempts" ON public.rate_limit_attempts;
CREATE POLICY "Admins can view rate limit attempts" ON public.rate_limit_attempts FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can view all deals" ON public.deals;
CREATE POLICY "Admins can view all deals" ON public.deals FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins can view all invoices" ON public.invoices;
CREATE POLICY "Admins can view all invoices" ON public.invoices FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Tighten overly permissive read policies
DROP POLICY "Authenticated users can view match stats" ON public.match_stats;
CREATE POLICY "Users can view own or team match stats" ON public.match_stats FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_team_member(auth.uid(), team_id) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY "Anyone can view player stats" ON public.player_stats;
CREATE POLICY "Users can view own or teammate player stats" ON public.player_stats FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.shares_team(auth.uid(), user_id) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY "Authenticated users can view substitute records" ON public.substitute_players;
CREATE POLICY "Users can view own or team substitute records" ON public.substitute_players FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_team_member(auth.uid(), original_team_id) OR private.is_team_member(auth.uid(), substitute_team_id) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY "Anyone can view team members" ON public.team_members;
CREATE POLICY "Users can view own or their teams members" ON public.team_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_team_member(auth.uid(), team_id) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY "Authenticated users can view team rosters" ON public.team_roster;
CREATE POLICY "Users can view own or their teams roster" ON public.team_roster FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_team_member(auth.uid(), team_id) OR private.has_role(auth.uid(), 'admin'));
