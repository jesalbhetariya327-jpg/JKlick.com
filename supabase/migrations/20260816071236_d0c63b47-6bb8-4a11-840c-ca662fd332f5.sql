CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  owner_name text NOT NULL,
  shop_name text NOT NULL,
  email text NOT NULL,
  whatsapp_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shops are publicly viewable" ON public.shops FOR SELECT USING (true);
CREATE POLICY "Owners can create their shop" ON public.shops FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their shop" ON public.shops FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete their shop" ON public.shops FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.owns_shop(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.user_id = auth.uid())
$$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  subcategory text,
  size text,
  color text,
  fabric text,
  quantity integer NOT NULL DEFAULT 0,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  sku text,
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_shop_id_idx ON public.products(shop_id);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are publicly viewable" ON public.products FOR SELECT USING (true);
CREATE POLICY "Owners can insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "Owners can update own products" ON public.products FOR UPDATE TO authenticated USING (public.owns_shop(shop_id)) WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "Owners can delete own products" ON public.products FOR DELETE TO authenticated USING (public.owns_shop(shop_id));

CREATE TABLE public.stock_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change_amount integer NOT NULL,
  reason text NOT NULL DEFAULT 'restock',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_log_product_id_idx ON public.stock_log(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_log TO authenticated;
GRANT ALL ON public.stock_log TO service_role;
ALTER TABLE public.stock_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view own stock log" ON public.stock_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.owns_shop(p.shop_id)));
CREATE POLICY "Owners can insert own stock log" ON public.stock_log FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.owns_shop(p.shop_id)));

CREATE TABLE public.tryon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, usage_date)
);
GRANT ALL ON public.tryon_usage TO service_role;
ALTER TABLE public.tryon_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();