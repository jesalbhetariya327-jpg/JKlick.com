REVOKE SELECT (upi_id) ON public.shops FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shop_upi(_shop_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.upi_id
  FROM public.shops s
  WHERE s.id = _shop_id
    AND auth.uid() IS NOT NULL
    AND (s.user_id = auth.uid() OR s.is_active)
$$;

REVOKE ALL ON FUNCTION public.get_shop_upi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_upi(uuid) TO authenticated;