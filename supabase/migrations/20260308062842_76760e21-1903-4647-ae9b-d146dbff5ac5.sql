
-- Drop all existing policies and recreate as explicitly PERMISSIVE

-- user_tokens
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_tokens;
CREATE POLICY "Users can view their own tokens" ON public.user_tokens AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
CREATE POLICY "Users can view their own purchases" ON public.purchases AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.purchases;
CREATE POLICY "Users can insert their own purchases" ON public.purchases AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND paid = false);

-- video_generations
DROP POLICY IF EXISTS "Users can view their own video generations" ON public.video_generations;
CREATE POLICY "Users can view their own video generations" ON public.video_generations AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own video generations" ON public.video_generations;
CREATE POLICY "Users can insert their own video generations" ON public.video_generations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own video generations" ON public.video_generations;
CREATE POLICY "Users can update their own video generations" ON public.video_generations AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);
