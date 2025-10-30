-- Revert handle_new_user to original - don't give free videos/images
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create a user_tokens record for the new user with 0 free videos/images
  INSERT INTO public.user_tokens (user_id, videos, images, tokens)
  VALUES (NEW.id, 0, 0, 0);
  
  RETURN NEW;
END;
$function$;