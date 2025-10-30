-- Update handle_new_user function to check IP address before giving free credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_ip TEXT;
  ip_exists BOOLEAN;
BEGIN
  -- Get the IP address from the user's metadata (if available)
  user_ip := NEW.raw_user_meta_data->>'ip_address';
  
  -- If no IP in metadata, give 0 credits
  IF user_ip IS NULL THEN
    INSERT INTO public.user_tokens (user_id, videos, images, tokens)
    VALUES (NEW.id, 0, 0, 0);
    RETURN NEW;
  END IF;
  
  -- Check if this IP has already received free credits
  SELECT EXISTS (
    SELECT 1 FROM public.trial_ips WHERE ip_address = user_ip
  ) INTO ip_exists;
  
  IF ip_exists THEN
    -- IP already used, give 0 free credits
    INSERT INTO public.user_tokens (user_id, videos, images, tokens)
    VALUES (NEW.id, 0, 0, 0);
  ELSE
    -- New IP, give free test credits and record the IP
    INSERT INTO public.user_tokens (user_id, videos, images, tokens)
    VALUES (NEW.id, 15, 20, 0);
    
    INSERT INTO public.trial_ips (ip_address, user_id)
    VALUES (user_ip, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add database constraints to prevent negative credits
ALTER TABLE user_tokens 
DROP CONSTRAINT IF EXISTS positive_videos,
DROP CONSTRAINT IF EXISTS positive_images,
DROP CONSTRAINT IF EXISTS positive_tokens;

ALTER TABLE user_tokens 
ADD CONSTRAINT positive_videos CHECK (videos >= 0),
ADD CONSTRAINT positive_images CHECK (images >= 0),
ADD CONSTRAINT positive_tokens CHECK (tokens >= 0);