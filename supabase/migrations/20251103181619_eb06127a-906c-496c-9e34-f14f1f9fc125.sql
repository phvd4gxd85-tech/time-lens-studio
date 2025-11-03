-- Ta bort admin_add_credits funktionen (säkerhetsrisk - krediter kan läggas till utan betalning)
DROP FUNCTION IF EXISTS public.admin_add_credits(uuid, integer, integer);

-- Ta bort trial_ips tabellen (inte nödvändig och saknar user_id kolumn)
DROP TABLE IF EXISTS public.trial_ips CASCADE;

-- Uppdatera handle_new_user() för att ENDAST ge 0 krediter till nya användare
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ge 0 credits till alla nya användare - de måste köpa krediter för att använda systemet
  INSERT INTO public.user_tokens (user_id, videos, images, tokens)
  VALUES (NEW.id, 0, 0, 0);
  
  RETURN NEW;
END;
$function$;