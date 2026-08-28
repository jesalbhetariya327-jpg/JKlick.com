import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatINR, whatsappLink, type Product, type Shop } from "@/lib/catalog";
import { TryOnDialog } from "@/components/TryOnDialog";
import { ProductImage } from "@/components/ProductImage";
import { addToCart, useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerAuthGate } from "@/components/CustomerAuthGate";

export const Route = createFileRoute("/product/$productId")({
  loader: async ({ params }) => {
    const { data: product } = await supabase
      .from("products")
      .select("product_name, category, color, fabric, size, selling_price, photo_url, shop_id")
      .eq("id", params.productId)
      .maybeSingle();
    if (!product) return null;
    const { data: shop } = await supabase
      .from("shops")
      .select("shop_name, is_active")
      .eq("id", product.shop_id)
      .maybeSingle();
    return {
      name: product.product_name as string,
      category: product.category as string,
      color: (product.color as string | null) ?? null,
      fabric: (product.fabric as string | null) ?? null,
      size: (product.size as string | null) ?? null,
      price: Number(product.selling_price),
      image: typeof product.photo_url === "string" && product.photo_url.startsWith("https://")
        ? (product.photo_url as string)
        : null,
      shopName: shop?.is_active ? (shop.shop_name as string) : null,
    };
  },
  head: ({ params, loaderData }) => {
    const url = `https://virar-style-magic.lovable.app/product/${params.productId}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Outfit details | JKlick" },
          {
            name: "description",
            content:
              "See outfit photos, price, size and colour, then try it on with AI before buying.",
          },
          { property: "og:title", content: "Outfit details | JKlick" },
          { property: "og:url", content: url },
          { property: "og:type", content: "product" },
          { name: "twitter:card", content: "summary_large_image" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const shopPart = loaderData.shopName ? ` at ${loaderData.shopName}` : "";
    const title = `${loaderData.name} | JKlick`;
    const details = [loaderData.color, loaderData.fabric, loaderData.size]
      .filter(Boolean)
      .join(", ");
    const description = `${loaderData.name}${shopPart} — ${loaderData.category}${
      details ? ` (${details})` : ""
    } at ₹${Math.round(loaderData.price)}. Try it on with AI before you order.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData.image
          ? [
              { property: "og:image", content: loaderData.image },
              { name: "twitter:image", content: loaderData.image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: loaderData.name,
            category: loaderData.category,
            ...(loaderData.color ? { color: loaderData.color } : {}),
            ...(loaderData.fabric ? { material: loaderData.fabric } : {}),
            ...(loaderData.size ? { size: loaderData.size } : {}),
            ...(loaderData.image ? { image: loaderData.image } : {}),
            ...(loaderData.shopName ? { brand: { "@type": "Brand", name: loaderData.shopName } } : {}),
            offers: {
              "@type": "Offer",
              price: loaderData.price,
              priceCurrency: "INR",
              url,
              availability: "https://schema.org/InStock",
            },
          }),
        },
      ],
    };
  },
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
        .select("id, user_id, owner_name, shop_name, whatsapp_number, slug, is_active, created_at")
        .eq("id", (product as Product).shop_id)
        .maybeSingle();
      return { product: product as Product, shop: (shop as Shop | null) ?? null };
    },
  });

  const product = data?.product ?? null;
  const shop = data?.shop ?? null;
  const { count } = useCart(shop?.id);

  if (isLoading) return <p className="p-6 text-center text-muted-foreground">Loading...</p>;
  if (!product) return <p className="p-6 text-center">Outfit not found.</p>;
  if (shop && !shop.is_active)
    return <p className="p-6 text-center">This shop is currently unavailable.</p>;

  return (
    <CustomerAuthGate shopId={shop?.id ?? null} shopName={shop?.shop_name ?? null}>
    <div className="min-h-screen bg-background pb-64">
      <div className="relative">
        <div className="aspect-[3/4] w-full bg-muted">
          <ProductImage
            src={product.photo_url}
            alt={product.product_name}
            className="size-full object-cover"
            loading="eager"
          />
        </div>
        <Link
          to={shop ? "/$shopSlug" : "/"}
          params={shop ? { shopSlug: shop.slug } : {}}
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
        <Button
          variant="secondary"
          className="h-12 w-full text-base"
          onClick={() => {
            if (!shop) return;
            addToCart(shop.id, {
              productId: product.id,
              name: product.product_name,
              price: Number(product.selling_price),
              photoUrl: product.photo_url,
            });
            toast.success("Added to your bag");
          }}
        >
          <ShoppingBag className="size-5" /> Add to bag
        </Button>
        {count > 0 && shop && (
          <Button asChild className="h-12 w-full text-base">
            <Link to="/checkout/$shopId" params={{ shopId: shop.id }}>
              Go to checkout ({count})
            </Link>
          </Button>
        )}
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
    </CustomerAuthGate>
  );
}
