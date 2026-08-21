REVOKE SELECT ON public.shops FROM anon, authenticated;

GRANT SELECT (id, user_id, owner_name, shop_name, whatsapp_number, slug, is_active, created_at, upi_id) ON public.shops TO anon, authenticated;

GRANT SELECT ON public.shops TO service_role;

DROP POLICY IF EXISTS "Shops are publicly viewable" ON public.shops;
CREATE POLICY "Shops are publicly viewable"
ON public.shops
FOR SELECT
TO anon, authenticated
USING (true);