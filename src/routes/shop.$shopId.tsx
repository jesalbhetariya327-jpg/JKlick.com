import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, formatINR, type Product, type Shop } from "@/lib/catalog";

export const Route = createFileRoute("/shop/$shopId")({
  head: () => ({
    meta: [
      { title: "Shop storefront | Virar Ethnic Stock" },
      {
        name: "description",
        content: "Browse this Virar shop's women's and girls' ethnic wear collection by category.",
      },
      { property: "og:title", content: "Shop storefront | Virar Ethnic Stock" },
      { property: "og:description", content: "Ethnic wear collection with AI try-on." },
    ],
  }),
  component: ShopPage,
  errorComponent: () => <p className="p-6 text-center">This shop could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Shop not found.</p>,
});

function ShopPage() {
  const { shopId } = Route.useParams();
  const [category, setCategory] = useState("All");

  const { data, isLoading } = useQuery({
    queryKey: ["shop-page", shopId],
    queryFn: async () => {
      const [shopRes, productsRes] = await Promise.all([
        supabase.from("shops").select("*").eq("id", shopId).maybeSingle(),
        supabase
          .from("products")
          .select("*")
          .eq("shop_id", shopId)
          .gt("quantity", 0)
          .order("created_at", { ascending: false }),
      ]);
      return {
        shop: (shopRes.data as Shop | null) ?? null,
        products: (productsRes.data ?? []) as Product[],
      };
    },
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  const visible = products.filter((p) => category === "All" || p.category === category);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-7 pt-6 text-primary-foreground">
        <Link to="/" className="inline-flex items-center gap-2 text-sm opacity-90">
          <ArrowLeft className="size-4" /> All shops
        </Link>
        <h1 className="mt-3 text-2xl font-bold">{data?.shop?.shop_name ?? "Shop"}</h1>
        <p className="text-sm opacity-85">{data?.shop?.owner_name}</p>
      </header>

      <div className="-mx-0 flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
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

      <main className="grid grid-cols-2 gap-3 px-4 py-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && visible.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">
            No outfits in this category yet.
          </p>
        )}
        {visible.map((product) => (
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
              <p className="mt-1 font-bold text-primary">
                {formatINR(Number(product.selling_price))}
              </p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
