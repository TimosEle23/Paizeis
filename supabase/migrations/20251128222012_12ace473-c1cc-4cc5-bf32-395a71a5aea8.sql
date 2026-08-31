-- Allow users to insert themselves into team_roster when they accept invitations
CREATE POLICY "Users can add themselves when accepting invitations"
ON public.team_roster
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 
    FROM public.team_members 
    WHERE team_members.user_id = auth.uid() 
    AND team_members.team_id = team_roster.team_id 
    AND team_members.status = 'accepted'
  )
);