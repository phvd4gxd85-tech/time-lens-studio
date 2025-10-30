-- Give all existing users 20 tokens
INSERT INTO public.user_tokens (user_id, tokens)
SELECT id, 20
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Update the trigger function to give 20 tokens instead of 3
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Create a user_tokens record for the new user with 20 free trial tokens
  INSERT INTO public.user_tokens (user_id, tokens)
  VALUES (NEW.id, 20);
  
  RETURN NEW;
END;
$$;