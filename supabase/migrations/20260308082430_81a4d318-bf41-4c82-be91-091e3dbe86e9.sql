
-- Fix purchases table: drop restrictive policies and create permissive ones
DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;

CREATE POLICY "Users can view their own purchases"
ON public.purchases
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases"
ON public.purchases
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND (paid = false));

-- Fix user_tokens: drop restrictive policy and create permissive one
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_tokens;

CREATE POLICY "Users can view their own tokens"
ON public.user_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
