
-- Fix all RLS policies: drop RESTRICTIVE ones and recreate as PERMISSIVE

-- user_tokens
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_tokens;
CREATE POLICY "Users can view their own tokens" ON public.user_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
CREATE POLICY "Users can view their own purchases" ON public.purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.purchases;
CREATE POLICY "Users can insert their own purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND paid = false);

-- video_generations
DROP POLICY IF EXISTS "Users can view their own video generations" ON public.video_generations;
CREATE POLICY "Users can view their own video generations" ON public.video_generations FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own video generations" ON public.video_generations;
CREATE POLICY "Users can insert their own video generations" ON public.video_generations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own video generations" ON public.video_generations;
CREATE POLICY "Users can update their own video generations" ON public.video_generations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
