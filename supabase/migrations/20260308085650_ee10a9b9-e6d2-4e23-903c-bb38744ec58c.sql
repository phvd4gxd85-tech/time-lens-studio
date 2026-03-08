-- 1. Create atomic credit decrement function for videos
CREATE OR REPLACE FUNCTION public.decrement_video_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE user_tokens
  SET videos = videos - 1, updated_at = now()
  WHERE user_id = p_user_id AND videos > 0;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

-- 2. Create atomic credit decrement function for images
CREATE OR REPLACE FUNCTION public.decrement_image_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE user_tokens
  SET images = images - 1, updated_at = now()
  WHERE user_id = p_user_id AND images > 0;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

-- 3. Fix all RESTRICTIVE RLS policies -> PERMISSIVE

-- user_tokens: drop and recreate SELECT as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_tokens;
CREATE POLICY "Users can view their own tokens"
  ON public.user_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- purchases: drop and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.purchases;
CREATE POLICY "Users can insert their own purchases"
  ON public.purchases
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND (paid = false));

DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
CREATE POLICY "Users can view their own purchases"
  ON public.purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- video_generations: drop and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can insert their own video generations" ON public.video_generations;
CREATE POLICY "Users can insert their own video generations"
  ON public.video_generations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own video generations" ON public.video_generations;
CREATE POLICY "Users can update their own video generations"
  ON public.video_generations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own video generations" ON public.video_generations;
CREATE POLICY "Users can view their own video generations"
  ON public.video_generations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- user_roles: drop and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on user_roles" ON public.user_roles;

-- contact_messages: add PERMISSIVE INSERT for anon
DROP POLICY IF EXISTS "Allow service role full access on contact_messages" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- free_trials: service role policy
CREATE POLICY "Service role manages free trials"
  ON public.free_trials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);