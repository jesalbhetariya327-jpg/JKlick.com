-- 1. Move ownership-check helper out of the exposed API schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.owns_shop(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION private.owns_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_shop(uuid) TO authenticated, service_role;

-- Recreate policies to use the relocated helper
DROP POLICY IF EXISTS "Owners can delete own products" ON public.products;
DROP POLICY IF EXISTS "Owners can insert own products" ON public.products;
DROP POLICY IF EXISTS "Owners can update own products" ON public.products;
DROP POLICY IF EXISTS "Owners can insert own stock log" ON public.stock_log;
DROP POLICY IF EXISTS "Owners can view own stock log" ON public.stock_log;

CREATE POLICY "Owners can delete own products" ON public.products FOR DELETE TO authenticated USING (private.owns_shop(shop_id));
CREATE POLICY "Owners can insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK (private.owns_shop(shop_id));
CREATE POLICY "Owners can update own products" ON public.products FOR UPDATE TO authenticated USING (private.owns_shop(shop_id)) WITH CHECK (private.owns_shop(shop_id));
CREATE POLICY "Owners can view own stock log" ON public.stock_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = stock_log.product_id AND private.owns_shop(p.shop_id)));
CREATE POLICY "Owners can insert own stock log" ON public.stock_log FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = stock_log.product_id AND private.owns_shop(p.shop_id)));

DROP FUNCTION IF EXISTS public.owns_shop(uuid);

-- 2. Storage: only the owning shop may write/replace/delete its product photos
DROP POLICY IF EXISTS "Owners can upload product photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update product photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete product photos" ON storage.objects;

CREATE POLICY "Owners can upload product photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND private.owns_shop(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "Owners can update product photos" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND private.owns_shop(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND private.owns_shop(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "Owners can delete product photos" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND private.owns_shop(((storage.foldername(name))[1])::uuid)
);

-- 3. Hide shop owner emails from public / non-owner reads (column-level security)
REVOKE SELECT ON public.shops FROM anon, authenticated;
GRANT SELECT (id, user_id, owner_name, shop_name, whatsapp_number, slug, created_at) ON public.shops TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;