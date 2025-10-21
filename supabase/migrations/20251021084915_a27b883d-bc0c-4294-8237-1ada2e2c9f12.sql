-- Add restrictive policy for trial_ips (backend-only access)
-- This table is only accessed by edge functions using service role
CREATE POLICY "No public access to trial IPs"
ON public.trial_ips
FOR ALL
USING (FALSE);