-- Give new users 15 videos and 20 images for testing (temporary)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create a user_tokens record for the new user with 15 videos and 20 images for testing
  INSERT INTO public.user_tokens (user_id, videos, images, tokens)
  VALUES (NEW.id, 15, 20, 0);
  
  RETURN NEW;
END;
$function$;