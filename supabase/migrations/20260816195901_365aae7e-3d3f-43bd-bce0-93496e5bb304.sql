REVOKE SELECT ON public.shops FROM anon, authenticated;
GRANT SELECT (id, user_id, owner_name, shop_name, whatsapp_number, slug, created_at) ON public.shops TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;