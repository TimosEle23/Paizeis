-- Add DELETE policy for tournament_teams to allow team captains to cancel registrations
CREATE POLICY "Team captains can delete their team registrations"
ON tournament_teams
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM teams
    WHERE teams.id = tournament_teams.team_id
    AND teams.captain_id = auth.uid()
  )
);