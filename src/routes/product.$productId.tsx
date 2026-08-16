import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatINR, whatsappLink, type Product, type Shop } from "@/lib/catalog";
import { TryOnDialog } from "@/components/TryOnDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/product/$productId")({
  head: () => ({
    meta: [
      { title: "Outfit details | Virar Ethnic Stock" },
      {
        name: "description",
        content: "See outfit photos, price, size and colour, then try it on with AI before buying.",
      },
      { property: "og:title", content: "Outfit details | Virar Ethnic Stock" },
      { property: "og:description", content: "Try this ethnic outfit on with AI and buy on WhatsApp." },
    ],
  }),
  component: ProductPage,
  errorComponent: () => <p className="p-6 text-center">This outfit could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Outfit not found.</p>,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const [tryOnOpen, setTryOnOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      if (!product) return { product: null, shop: null };
      const { data: shop } = await supabase
        .from("shops")
        .select("*")
        .eq("id", (product as Product).shop_id)
        .maybeSingle();
      return { product: product as Product, shop: (shop as Shop | null) ?? null };
    },
  });

  const product = data?.product ?? null;
  const shop = data?.shop ?? null;

  if (isLoading) return <p className="p-6 text-center text-muted-foreground">Loading...</p>;
  if (!product) return <p className="p-6 text-center">Outfit not found.</p>;

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="relative">
        <div className="aspect-[3/4] w-full bg-muted">
          {product.photo_url ? (
            <img
              src={product.photo_url}
              alt={product.product_name}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        <Link
          to="/"
          className="absolute left-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-background/90 shadow-soft"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <main className="space-y-4 px-4 py-5">
        <div>
          <h1 className="text-2xl font-bold">{product.product_name}</h1>
          <p className="text-sm text-muted-foreground">{shop?.shop_name}</p>
          <p className="mt-2 text-2xl font-bold text-primary">
            {formatINR(Number(product.selling_price))}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{product.category}</Badge>
          {product.subcategory && <Badge variant="secondary">{product.subcategory}</Badge>}
          {product.size && <Badge variant="secondary">Size {product.size}</Badge>}
          {product.color && <Badge variant="secondary">{product.color}</Badge>}
          {product.fabric && <Badge variant="secondary">{product.fabric}</Badge>}
        </div>

        {product.notes && <p className="text-sm text-muted-foreground">{product.notes}</p>}
      </main>

      <div className="fixed inset-x-0 bottom-0 space-y-2 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button className="h-14 w-full text-base" onClick={() => setTryOnOpen(true)}>
          <Sparkles className="size-5" /> Try It On
        </Button>
        <Button asChild variant="outline" className="h-12 w-full text-base">
          <a
            href={whatsappLink(
              shop?.whatsapp_number,
              `Hi ${shop?.shop_name ?? ""}! I'm interested in "${product.product_name}".`,
            )}
            target="_blank"
            rel="noreferrer"
          >
            Contact shop to buy
          </a>
        </Button>
      </div>

      <TryOnDialog open={tryOnOpen} onOpenChange={setTryOnOpen} product={product} shop={shop} />
    </div>
  );
}
