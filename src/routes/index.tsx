import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Sparkles, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, formatINR, type Product, type Shop } from "@/lib/catalog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Virar Ethnic Stock | Women's & Girls' Ethnic Wear" },
      {
        name: "description",
        content:
          "Browse Patiala suits, lehengas, kurtis and sarees from Virar shops. Try outfits on with AI and buy on WhatsApp.",
      },
      { property: "og:title", content: "Virar Ethnic Stock | Women's & Girls' Ethnic Wear" },
      {
        property: "og:description",
        content: "Shop ethnic wear from local Virar stores with AI try-on.",
      },
    ],
  }),
  component: Storefront,
});

function Storefront() {
  const [category, setCategory] = useState("All");
  const [shopFilter, setShopFilter] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["storefront"],
    queryFn: async () => {
      const [productsRes, shopsRes] = await Promise.all([
        supabase.from("products").select("*").gt("quantity", 0).order("created_at", { ascending: false }),
        supabase.from("shops").select("*").order("shop_name"),
      ]);
      return {
        products: (productsRes.data ?? []) as Product[],
        shops: (shopsRes.data ?? []) as Shop[],
      };
    },
  });

  const products = data?.products ?? [];
  const shops = data?.shops ?? [];

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = category === "All" || p.category === category;
      const matchesShop = shopFilter === "All" || p.shop_id === shopFilter;
      const matchesSearch =
        !term ||
        [p.product_name, p.color, p.fabric, p.subcategory]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return matchesCategory && matchesShop && matchesSearch;
    });
  }, [products, category, shopFilter, search]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-8 pt-6 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] opacity-85">Virar</p>
          <Button asChild size="sm" variant="secondary">
            <Link to="/auth">Shop owner login</Link>
          </Button>
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight">Ethnic Stock</h1>
        <p className="mt-2 max-w-sm text-sm opacity-90">
          Women's and girls' ethnic wear from local shops — see it on yourself before you buy.
        </p>
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
        {shops.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {[{ id: "All", shop_name: "All shops" }, ...shops].map((s) => (
              <button
                key={s.id}
                onClick={() => setShopFilter(s.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  shopFilter === s.id
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {s.shop_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="px-4 py-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading outfits...</p>}

        {!isLoading && visible.length === 0 && (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <Store className="size-8 text-muted-foreground" />
              <p className="font-medium">No outfits listed yet</p>
              <p className="text-sm text-muted-foreground">
                Shops are still adding stock. Please check back soon.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {visible.map((product) => {
            const shop = shops.find((s) => s.id === product.shop_id);
            return (
              <Link
                key={product.id}
                to="/product/$productId"
                params={{ productId: product.id }}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
              >
                <div className="aspect-[3/4] bg-muted">
                  {product.photo_url ? (
                    <img
                      src={product.photo_url}
                      alt={product.product_name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{product.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{shop?.shop_name}</p>
                  <p className="mt-1 font-bold text-primary">
                    {formatINR(Number(product.selling_price))}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
