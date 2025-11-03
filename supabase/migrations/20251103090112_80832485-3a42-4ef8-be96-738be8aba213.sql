-- 1. Skapa admin funktion för att lägga till credits
CREATE OR REPLACE FUNCTION public.admin_add_credits(
  target_user_id UUID,
  add_videos INTEGER,
  add_images INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_tokens
  SET 
    videos = videos + add_videos,
    images = images + add_images,
    updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;

-- 2. RLS policy för purchases INSERT
CREATE POLICY "Users can insert their own purchases"
ON public.purchases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. RLS policy för video_generations UPDATE
CREATE POLICY "Users can update their own video generations"
ON public.video_generations
FOR UPDATE
USING (auth.uid() = user_id);

-- 4. Uppdatera handle_new_user för att ge 0 credits till nya användare (stäng av gratiskonton)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_ip TEXT;
BEGIN
  -- Get the IP address from the user's metadata (if available)
  user_ip := NEW.raw_user_meta_data->>'ip_address';
  
  -- Ge 0 credits till alla nya användare (gratiskonton avstängda)
  INSERT INTO public.user_tokens (user_id, videos, images, tokens)
  VALUES (NEW.id, 0, 0, 0);
  
  -- Registrera IP om det finns
  IF user_ip IS NOT NULL THEN
    INSERT INTO public.trial_ips (ip_address, user_id)
    VALUES (user_ip, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;