-- 1. Shop UPI id
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS upi_id text;

-- 2. Customer profiles (separate from shop owners)
CREATE TABLE IF NOT EXISTS public.customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view their own profile" ON public.customers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Customers create their own profile" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Customers update their own profile" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Customers delete their own profile" ON public.customers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Saved try-on photos, visible only to the owning customer
CREATE TABLE IF NOT EXISTS public.customer_tryons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_tryons_customer_idx ON public.customer_tryons(customer_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.customer_tryons TO authenticated;
GRANT ALL ON public.customer_tryons TO service_role;
ALTER TABLE public.customer_tryons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own saved try-ons" ON public.customer_tryons FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Customers save own try-ons" ON public.customer_tryons FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers delete own saved try-ons" ON public.customer_tryons FOR DELETE TO authenticated USING (auth.uid() = customer_id);

-- 4. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_screenshot_path text,
  status text NOT NULL DEFAULT 'requested',
  customer_name text NOT NULL DEFAULT '',
  customer_phone text,
  customer_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('requested','confirmed','completed','cancelled'))
);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_shop_idx ON public.orders(shop_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Shop owners view their shop orders" ON public.orders FOR SELECT TO authenticated USING (private.owns_shop(shop_id));
CREATE POLICY "Customers create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Shop owners update their shop orders" ON public.orders FOR UPDATE TO authenticated USING (private.owns_shop(shop_id)) WITH CHECK (private.owns_shop(shop_id));

-- 5. Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order participants view items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.customer_id = auth.uid() OR private.owns_shop(o.shop_id)))
);
CREATE POLICY "Customers add items to own orders" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid())
);