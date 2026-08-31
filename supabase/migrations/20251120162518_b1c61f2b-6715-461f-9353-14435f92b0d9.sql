-- Fix search_path for check_substitute_limit function
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