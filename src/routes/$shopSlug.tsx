import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Sparkles, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, formatINR, type Product, type Shop } from "@/lib/catalog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/ProductImage";

export const Route = createFileRoute("/$shopSlug")({
  head: () => ({
    meta: [
      { title: "Shop storefront | Virar Ethnic Stock" },
      {
        name: "description",
        content: "Browse this shop's women's and girls' ethnic wear and try outfits on with AI.",
      },
      { property: "og:title", content: "Shop storefront | Virar Ethnic Stock" },
      { property: "og:description", content: "Ethnic wear collection with AI try-on." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopStorefront,
  errorComponent: () => <p className="p-6 text-center">This shop could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Shop not found.</p>,
});

function ShopStorefront() {
  const { shopSlug } = Route.useParams();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["shop-storefront", shopSlug],
    queryFn: async () => {
      const { data: shop } = await supabase
        .from("shops")
        .select("id, user_id, owner_name, shop_name, whatsapp_number, slug, created_at")
        .eq("slug", shopSlug)
        .maybeSingle();
      if (!shop) return { shop: null, products: [] as Product[] };
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

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = category === "All" || p.category === category;
      const matchesSearch =
        !term ||
        [p.product_name, p.color, p.fabric, p.subcategory]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [products, category, search]);

  if (!isLoading && !shop) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">This shop link is not valid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-8 pt-6 text-primary-foreground">
        <p className="text-xs uppercase tracking-[0.2em] opacity-85">Virar Ethnic Stock</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">{shop?.shop_name ?? "Shop"}</h1>
        {shop?.owner_name && <p className="mt-1 text-sm opacity-85">{shop.owner_name}</p>}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1.5 text-xs backdrop-blur">
          <Sparkles className="size-3.5" /> AI try-on on every product
        </div>
      </header>

      <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-9"
            placeholder="Search outfits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
    </div>
  );
}
