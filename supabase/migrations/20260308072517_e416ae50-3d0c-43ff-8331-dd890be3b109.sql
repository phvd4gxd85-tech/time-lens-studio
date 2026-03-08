CREATE TABLE public.free_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.free_trials ENABLE ROW LEVEL SECURITY;