-- Fix handle_new_user to give 10 videos and 20 images instead of 20 tokens
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create a user_tokens record for the new user with 10 videos and 20 images
  INSERT INTO public.user_tokens (user_id, videos, images, tokens)
  VALUES (NEW.id, 10, 20, 0);
  
  RETURN NEW;
END;
$function$;