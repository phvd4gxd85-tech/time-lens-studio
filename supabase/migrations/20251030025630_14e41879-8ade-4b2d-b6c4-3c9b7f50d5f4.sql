-- Update the function to set search_path properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Create a user_tokens record for the new user with 3 free trial tokens
  INSERT INTO public.user_tokens (user_id, tokens)
  VALUES (NEW.id, 3);
  
  RETURN NEW;
END;
$$;