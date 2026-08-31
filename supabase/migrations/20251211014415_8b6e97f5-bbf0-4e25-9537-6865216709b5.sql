-- Drop the overly permissive policy that allows all users to see all roles
DROP POLICY IF EXISTS "Users can view all roles" ON user_roles;

-- Create a new policy that only allows users to see their own roles, or admins to see all
CREATE POLICY "Users can view own roles or admin can view all"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));