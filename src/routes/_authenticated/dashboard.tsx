import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  LogOut,
  Minus,
  Plus,
  Search,
  Pencil,
  Trash2,
  Store,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ClipboardList,
  Wallet,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIES,
  LOW_STOCK_THRESHOLD,
  formatINR,
  type Product,
  type Shop,
} from "@/lib/catalog";
import { ProductForm } from "@/components/ProductForm";
import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Stock Dashboard | Virar Ethnic Stock" },
      {
        name: "description",
        content: "Manage ethnic wear inventory, stock levels and prices for your Virar garment shop.",
      },
      { property: "og:title", content: "Stock Dashboard | Virar Ethnic Stock" },
      { property: "og:description", content: "Add products, track stock and see your inventory value." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [savingUpi, setSavingUpi] = useState(false);

  const shopQuery = useQuery({
    queryKey: ["my-shop"],
    queryFn: async (): Promise<Shop | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("shops")
        .select("id, user_id, owner_name, shop_name, whatsapp_number, slug, is_active, created_at")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return (data as Shop | null) ?? null;
    },
  });

  const shop = shopQuery.data ?? null;

  const upiQuery = useQuery({
    queryKey: ["my-shop-upi", shop?.id],
    enabled: !!shop?.id,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.rpc("get_shop_upi", { _shop_id: shop!.id });
      return (data as string | null) ?? null;
    },
  });

  useEffect(() => {
    if (upiQuery.data) setUpiId((v) => v || upiQuery.data || "");
  }, [upiQuery.data]);


  const saveUpi = async () => {
    if (!shop) return;
    setSavingUpi(true);
    const { error } = await supabase
      .from("shops")
      .update({ upi_id: upiId.trim() || null })
      .eq("id", shop.id);
    setSavingUpi(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("UPI ID saved");
    void queryClient.invalidateQueries({ queryKey: ["my-shop-upi"] });

  };

  const adminQuery = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return !!data;
    },
  });

  const productsQuery = useQuery({
    queryKey: ["my-products", shop?.id],
    enabled: !!shop?.id,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", shop!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      // A search term searches the whole inventory, ignoring the active category tab.
      const matchesCategory = term.length > 0 || category === "All" || p.category === category;
      const matchesSearch =
        !term ||
        [p.product_name, p.sku, p.color, p.fabric, p.subcategory, p.category, p.size, p.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [products, category, search]);

  const totalStockValue = products.reduce((sum, p) => sum + p.quantity * Number(p.selling_price), 0);

  const adjustStock = async (product: Product, delta: number) => {
    const next = Math.max(0, product.quantity + delta);
    if (next === product.quantity) return;
    const { error } = await supabase.from("products").update({ quantity: next }).eq("id", product.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("stock_log").insert({
      product_id: product.id,
      change_amount: delta,
      reason: delta > 0 ? "restock" : "sale",
    });
    void queryClient.invalidateQueries({ queryKey: ["my-products", shop?.id] });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("products").delete().eq("id", deleting.id);
    setDeleting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Product deleted");
    void queryClient.invalidateQueries({ queryKey: ["my-products", shop?.id] });
  };

  const storefrontUrl = shop
    ? `${typeof window === "undefined" ? "" : window.location.origin}/${shop.slug}`
    : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
    } catch {
      toast.error("Could not copy — please copy the link manually");
      return;
    }
    setCopied(true);
    toast.success("Storefront link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="bg-royal px-4 pb-6 pt-6 text-primary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Virar Ethnic Stock</p>
            <h1 className="text-2xl font-bold">{shop?.shop_name ?? "Your shop"}</h1>
            <p className="text-sm opacity-80">{shop?.owner_name}</p>
          </div>
          <Button size="icon" variant="secondary" onClick={() => void signOut()} aria-label="Log out">
            <LogOut className="size-4" />
          </Button>
        </div>

        {shop && !shop.is_active && (
          <div className="mt-4 rounded-xl bg-destructive/90 p-3 text-sm text-destructive-foreground">
            Your shop is suspended. Your storefront link is hidden from shoppers.
          </div>
        )}

        <Link
          to="/shop-orders"
          className="mt-4 mr-2 inline-flex items-center gap-1 rounded-full bg-background/15 px-3 py-1.5 text-sm backdrop-blur"
        >
          <ClipboardList className="size-4" /> Orders
        </Link>

        {adminQuery.data && (
          <Link
            to="/admin"
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-background/15 px-3 py-1.5 text-sm backdrop-blur"
          >
            <ShieldCheck className="size-4" /> Admin analytics
          </Link>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background/15 p-3 backdrop-blur">
            <p className="text-xs opacity-80">Total products</p>
            <p className="text-xl font-bold">{products.length}</p>
          </div>
          <div className="rounded-xl bg-background/15 p-3 backdrop-blur">
            <p className="text-xs opacity-80">Stock value</p>
            <p className="text-xl font-bold">{formatINR(totalStockValue)}</p>
          </div>
        </div>

        {shop && (
          <div className="mt-4 rounded-xl bg-background/15 p-3 backdrop-blur">
            <p className="text-xs opacity-80">Your storefront link</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{storefrontUrl}</p>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 shrink-0"
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <Link
              to="/$shopSlug"
              params={{ shopSlug: shop.slug }}
              className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4 opacity-90"
            >
              <ExternalLink className="size-4" /> Open my storefront
            </Link>
          </div>
        )}
        {shop && (
          <div className="mt-4 rounded-xl bg-background/15 p-3 backdrop-blur">
            <p className="flex items-center gap-1 text-xs opacity-80">
              <Wallet className="size-3.5" /> Your UPI ID (shoppers pay here)
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Input
                className="h-10 flex-1 bg-background text-foreground"
                placeholder="yourname@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-10 shrink-0"
                disabled={savingUpi}
                onClick={() => void saveUpi()}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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

      <main className="space-y-3 px-4 py-4">
        {productsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading stock...</p>}
        {!productsQuery.isLoading && visible.length === 0 && (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <Store className="size-8 text-muted-foreground" />
              <p className="font-medium">No products here yet</p>
              <p className="text-sm text-muted-foreground">Add your first item to start tracking stock.</p>
            </CardContent>
          </Card>
        )}

        {visible.map((product) => (
          <Card key={product.id} className="overflow-hidden py-0 shadow-soft">
            <CardContent className="flex gap-3 p-3">
              <div className="size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                <ProductImage
                  src={product.photo_url}
                  alt={product.product_name}
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{product.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[product.category, product.size, product.color].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-primary">
                    {formatINR(Number(product.selling_price))}
                  </p>
                </div>

                {product.quantity < LOW_STOCK_THRESHOLD && (
                  <Badge variant="destructive" className="mt-1">
                    Low stock
                  </Badge>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-10"
                    onClick={() => void adjustStock(product, -1)}
                    aria-label="Decrease stock"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-10 text-center font-semibold">{product.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-10"
                    onClick={() => void adjustStock(product, 1)}
                    aria-label="Increase stock"
                  >
                    <Plus className="size-4" />
                  </Button>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-10"
                      onClick={() => {
                        setEditing(product);
                        setFormOpen(true);
                      }}
                      aria-label="Edit product"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-10 text-destructive"
                      onClick={() => setDeleting(product)}
                      aria-label="Delete product"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button
          className="h-14 w-full text-base"
          disabled={!shop}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-5" /> Add product
        </Button>
      </div>

      {shop && (
        <ProductForm
          open={formOpen}
          onOpenChange={setFormOpen}
          shopId={shop.id}
          product={editing}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["my-products", shop.id] })}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.product_name}" will be removed from your stock permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
