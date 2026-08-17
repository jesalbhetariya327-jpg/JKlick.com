-- Track try-on generation detail for analytics
ALTER TABLE public.tryon_log
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS duration_ms integer NOT NULL DEFAULT 0;

-- Track shop owner logins
CREATE TABLE IF NOT EXISTS public.login_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.login_log TO authenticated;
GRANT ALL ON public.login_log TO service_role;

ALTER TABLE public.login_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can record their own logins" ON public.login_log;
CREATE POLICY "Owners can record their own logins"
ON public.login_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can view their own logins" ON public.login_log;
CREATE POLICY "Owners can view their own logins"
ON public.login_log FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS login_log_shop_idx ON public.login_log (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tryon_log_shop_idx ON public.tryon_log (shop_id, created_at DESC);