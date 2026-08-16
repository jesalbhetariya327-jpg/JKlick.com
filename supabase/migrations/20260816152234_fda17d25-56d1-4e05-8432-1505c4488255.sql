ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.shop_slugify(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_name,'shop')), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; candidate text; n int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN RETURN NEW; END IF;
  base := public.shop_slugify(NEW.shop_name);
  IF base = '' OR base IS NULL THEN base := 'shop'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.shops s WHERE s.slug = candidate AND s.id <> NEW.id) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS shops_set_slug ON public.shops;
CREATE TRIGGER shops_set_slug BEFORE INSERT OR UPDATE OF shop_name ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.set_shop_slug();

UPDATE public.shops SET slug = NULL WHERE slug IS NULL;
DO $$
DECLARE r record; base text; candidate text; n int;
BEGIN
  FOR r IN SELECT id, shop_name FROM public.shops WHERE slug IS NULL OR slug = '' LOOP
    base := public.shop_slugify(r.shop_name);
    IF base = '' OR base IS NULL THEN base := 'shop'; END IF;
    candidate := base; n := 1;
    WHILE EXISTS (SELECT 1 FROM public.shops s WHERE s.slug = candidate) LOOP
      n := n + 1; candidate := base || '-' || n;
    END LOOP;
    UPDATE public.shops SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.shops ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_key ON public.shops (slug);