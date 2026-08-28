import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ShoppingBag, SlidersHorizontal, Sparkles, Store, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, formatINR, type Product, type Shop } from "@/lib/catalog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/ProductImage";
import { CartBar } from "@/components/CartBar";
import { CustomerAuthGate } from "@/components/CustomerAuthGate";

export const Route = createFileRoute("/$shopSlug")({
  loader: async ({ params }) => {
    const { data: shop } = await supabase
      .from("shops")
      .select("shop_name, owner_name, is_active")
      .eq("slug", params.shopSlug)
      .maybeSingle();
    if (!shop || !shop.is_active) return { shopName: null as string | null, categories: [] as string[] };
    const { data: rows } = await supabase
      .from("products")
      .select("category, shops!inner(slug)")
      .eq("shops.slug", params.shopSlug)
      .gt("quantity", 0);
    const categories = Array.from(new Set((rows ?? []).map((r) => r.category))).slice(0, 6);
    return { shopName: shop.shop_name as string, categories };
  },
  head: ({ params, loaderData }) => {
    const shopName = loaderData?.shopName ?? "Ethnic wear shop";
    const url = `https://virar-style-magic.lovable.app/${params.shopSlug}`;
    const cats = loaderData?.categories?.length
      ? loaderData.categories.join(", ")
      : "Patiala suits, churidars, lehengas, kurtis and sarees";
    const title = `${shopName} | Ethnic Wear Collection with AI Try-On`;
    const description = `Browse ${shopName}'s women's and girls' ethnic wear — ${cats}. Try outfits on with AI and order online with UPI payment.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: "https://virar-style-magic.lovable.app/apple-touch-icon.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: "https://virar-style-magic.lovable.app/apple-touch-icon.png" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: shopName,
            url,
            description,
            image: "https://virar-style-magic.lovable.app/apple-touch-icon.png",
            address: { "@type": "PostalAddress", addressLocality: "Virar", addressCountry: "IN" },
          }),
        },
      ],
    };
  },

  component: ShopStorefront,
  errorComponent: () => <p className="p-6 text-center">This shop could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Shop not found.</p>,
});

function ShopStorefront() {
  const { shopSlug } = Route.useParams();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");


  const { data, isLoading } = useQuery({
    queryKey: ["shop-storefront", shopSlug],
    queryFn: async () => {
      const { data: shop } = await supabase
        .from("shops")
        .select("id, user_id, owner_name, shop_name, whatsapp_number, slug, is_active, created_at")
        .eq("slug", shopSlug)
        .maybeSingle();
      if (!shop) return { shop: null, products: [] as Product[] };
      if (!(shop as Shop).is_active) return { shop: shop as Shop, products: [] as Product[] };
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", (shop as Shop).id)
        .gt("quantity", 0)
        .order("created_at", { ascending: false });
      return { shop: shop as Shop, products: (products ?? []) as Product[] };
    },
  });

  const shop = data?.shop ?? null;
  const products = useMemo(() => data?.products ?? [], [data]);

  const colors = useMemo(
    () => Array.from(new Set(products.map((p) => p.color).filter(Boolean) as string[])).sort(),
    [products],
  );
  const sizes = useMemo(
    () => Array.from(new Set(products.map((p) => p.size).filter(Boolean) as string[])).sort(),
    [products],
  );
  const maxPrice = useMemo(
    () => products.reduce((m, p) => Math.max(m, Number(p.selling_price)), 0),
    [products],
  );

  const filtersActive =
    !!color || !!size || minPrice.trim() !== "" || maxPriceInput.trim() !== "";

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const lo = minPrice.trim() === "" ? 0 : Number(minPrice);
    const hi = maxPriceInput.trim() === "" ? Infinity : Number(maxPriceInput);
    return products.filter((p) => {
      // Search or a filter looks across the whole catalog, ignoring the active category tab.
      const matchesCategory =
        term.length > 0 || filtersActive || category === "All" || p.category === category;
      const matchesSearch =
        !term ||
        [p.product_name, p.sku, p.color, p.fabric, p.subcategory, p.category, p.size]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      const price = Number(p.selling_price);
      const matchesPrice = price >= (Number.isFinite(lo) ? lo : 0) && price <= (Number.isFinite(hi) ? hi : Infinity);
      const matchesColor = !color || p.color === color;
      const matchesSize = !size || p.size === size;
      return matchesCategory && matchesSearch && matchesPrice && matchesColor && matchesSize;
    });
  }, [products, category, search, color, size, minPrice, maxPriceInput, filtersActive]);


  if (!isLoading && shop && !shop.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">This shop is currently unavailable.</p>
      </div>
    );
  }

  if (!isLoading && !shop) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">This shop link is not valid.</p>
      </div>
    );
  }

  return (
    <CustomerAuthGate shopId={shop?.id ?? null} shopName={shop?.shop_name ?? null}>
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-royal px-4 pb-8 pt-6 text-primary-foreground">
        <p className="text-xs uppercase tracking-[0.2em] opacity-85">JKlick</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">{shop?.shop_name ?? "Shop"}</h1>
        {shop?.owner_name && <p className="mt-1 text-sm opacity-85">{shop.owner_name}</p>}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1.5 text-xs backdrop-blur">
          <Sparkles className="size-3.5" /> AI try-on on every product
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs opacity-85">
          <ShoppingBag className="size-3.5" /> Add outfits to your bag and pay by UPI
        </div>
      </header>

      <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-9"
            aria-label="Search outfits"
            placeholder="Search outfits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${
              filtersActive ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            <SlidersHorizontal className="size-4" /> Filters
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setColor("");
                setSize("");
                setMinPrice("");
                setMaxPriceInput("");
              }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
            >
              <X className="size-3.5" /> Clear filters
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Price range (₹)</p>
              <div className="flex items-center gap-2">
                <Input
                  className="h-10"
                  inputMode="numeric"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ""))}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  className="h-10"
                  inputMode="numeric"
                  placeholder={maxPrice ? String(Math.round(maxPrice)) : "Max"}
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
            </div>

            {colors.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Colour</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(color === c ? "" : c)}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        color === c
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Size</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(size === s ? "" : s)}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        size === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading outfits...</p>}

        {!isLoading && visible.length === 0 && (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <Store className="size-8 text-muted-foreground" />
              <p className="font-medium">No outfits here yet</p>
              <p className="text-sm text-muted-foreground">Please check back soon.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {visible.map((product) => (
            <Link
              key={product.id}
              to="/product/$productId"
              params={{ productId: product.id }}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="aspect-[3/4] bg-muted">
                <ProductImage
                  src={product.photo_url}
                  alt={product.product_name}
                  className="size-full object-cover"
                />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{product.product_name}</p>
                <p className="mt-1 font-bold text-primary">
                  {formatINR(Number(product.selling_price))}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {shop && <CartBar shopId={shop.id} shopSlug={shop.slug} />}
    </div>
    </CustomerAuthGate>
  );
}
