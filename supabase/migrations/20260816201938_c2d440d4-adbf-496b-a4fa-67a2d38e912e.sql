-- 1. Shop active flag
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Cascade deletes from auth account -> shop -> products/stock_log
DELETE FROM public.stock_log sl WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = sl.product_id);
DELETE FROM public.products p WHERE NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = p.shop_id);
DELETE FROM public.shops s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_user_id_fkey;
ALTER TABLE public.shops ADD CONSTRAINT shops_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_shop_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_shop_id_fkey
  FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE public.stock_log DROP CONSTRAINT IF EXISTS stock_log_product_id_fkey;
ALTER TABLE public.stock_log ADD CONSTRAINT stock_log_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 3. Admin list (separate table: never a flag on a user-editable row)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can see their own admin row" ON public.admins;
CREATE POLICY "Admins can see their own admin row" ON public.admins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM public, anon, authenticated;

INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE lower(email) IN ('socialguy327@gmail.com','jesalbhetariya327@gmail.com')
ON CONFLICT DO NOTHING;

-- 4. Try-on generation log
CREATE TABLE IF NOT EXISTS public.tryon_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tryon_log TO service_role;
ALTER TABLE public.tryon_log ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated grants: written and read only by trusted server code.

-- 5. Suspended shops disappear from the public storefront
DROP POLICY IF EXISTS "Products are publicly viewable" ON public.products;
CREATE POLICY "Active shops' products are publicly viewable" ON public.products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = products.shop_id AND s.is_active)
  );
DROP POLICY IF EXISTS "Owners can view own products" ON public.products;
CREATE POLICY "Owners can view own products" ON public.products
  FOR SELECT TO authenticated USING (private.owns_shop(shop_id));