import { getShopUpi } from "@/lib/shop.functions";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Banknote, Minus, Plus, Upload, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatINR, type Shop } from "@/lib/catalog";
import { clearCart, setQty, upiLink, useCart } from "@/lib/cart";
import { compressImageFile } from "@/lib/image-compress";
import { createOrder } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/checkout/$shopId")({
  head: () => ({
    meta: [
      { title: "Checkout | JKlick" },
      {
        name: "description",
        content: "Review your ethnic wear order, pay by UPI and upload your payment screenshot.",
      },
      { property: "og:title", content: "Checkout | JKlick" },
      { property: "og:description", content: "Pay by UPI and confirm your order." },
    ],
  }),
  component: Checkout,
  errorComponent: () => <p className="p-6 text-center">Checkout could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Page not found.</p>,
});

function Checkout() {
  const { shopId } = Route.useParams();
  const navigate = useNavigate();
  const submitOrder = useServerFn(createOrder);
  const fileRef = useRef<HTMLInputElement>(null);
  const { items, total } = useCart(shopId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [payMethod, setPayMethod] = useState<"cod" | "upi">("cod");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  const shopQuery = useQuery({
    queryKey: ["checkout-shop", shopId],
    queryFn: async (): Promise<Shop | null> => {
      const { data } = await supabase
        .from("shops")
        .select("id, user_id, owner_name, shop_name, whatsapp_number, slug, is_active, created_at")
        .eq("id", shopId)
        .maybeSingle();
      return (data as Shop | null) ?? null;
    },
  });

  const upiQuery = useQuery({
    queryKey: ["checkout-shop-upi", shopId],
    queryFn: async (): Promise<string | null> => {
      return (await getShopUpi({ data: { shopId } })) ?? null;
    },
  });


  const profileQuery = useQuery({
    queryKey: ["my-customer-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("customers")
        .select("user_id, full_name, phone")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setName((n) => n || (profileQuery.data?.full_name ?? ""));
      setPhone((p) => p || (profileQuery.data?.phone ?? ""));
    }
  }, [profileQuery.data]);

  const shop = shopQuery.data ?? null;

  const place = async () => {
    if (!shop) return;
    if (!name.trim()) {
      toast.error("Enter your name so the shop knows who ordered");
      return;
    }
    if (address.trim().length < 5) {
      toast.error("Enter your full delivery address");
      return;
    }
    if (payMethod === "upi" && !screenshot) {
      toast.error("Upload your payment screenshot to submit the order");
      return;
    }
    setBusy(true);
    const res = await submitOrder({
      data: {
        shopId,
        items: items.map((i) => ({ productId: i.productId, quantity: i.qty })),
        customerName: name.trim(),
        customerPhone: phone.trim() || null,
        deliveryAddress: address.trim(),
        paymentMethod: payMethod,
        screenshot: payMethod === "upi" ? screenshot : null,
      },
    });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("ok" in res && res.ok) {
      clearCart(shopId);
      toast.success(
        payMethod === "cod" ? "Order placed! Pay in cash on delivery." : "Order placed!",
      );
      navigate({ to: "/my-orders", replace: true });
    }
  };


  if (shopQuery.isLoading) return <p className="p-6 text-center text-muted-foreground">Loading...</p>;
  if (!shop) return <p className="p-6 text-center">This shop could not be found.</p>;

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-medium">Your cart is empty.</p>
        <Link to="/$shopSlug" params={{ shopSlug: shop.slug }} className="text-sm underline underline-offset-4">
          Back to {shop.shop_name}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-6 pt-6 text-primary-foreground">
        <Link
          to="/$shopSlug"
          params={{ shopSlug: shop.slug }}
          className="inline-flex items-center gap-1 text-sm opacity-90"
        >
          <ArrowLeft className="size-4" /> {shop.shop_name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Checkout</h1>
      </header>

      <main className="space-y-4 px-4 py-5">
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Order summary</h2>
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatINR(item.price)} each</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9"
                    onClick={() => setQty(shopId, item.productId, item.qty - 1)}
                    aria-label="Reduce quantity"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-7 text-center text-sm font-semibold">{item.qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9"
                    onClick={() => setQty(shopId, item.productId, item.qty + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <p className="w-20 shrink-0 text-right text-sm font-semibold">
                  {formatINR(item.price * item.qty)}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="font-medium">Total</p>
              <p className="text-xl font-bold text-primary">{formatINR(total)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-2">
              <Label htmlFor="cname">Your name</Label>
              <Input id="cname" className="h-12" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cphone">Phone number</Label>
              <Input
                id="cphone"
                className="h-12"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caddr">Delivery address</Label>
              <Textarea
                id="caddr"
                rows={3}
                placeholder="House / flat, street, area, city, pincode"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Payment method</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayMethod("cod")}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-medium ${
                  payMethod === "cod" ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <Banknote className="size-5" /> Cash on Delivery
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("upi")}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-medium ${
                  payMethod === "upi" ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <Wallet className="size-5" /> Pay Online via UPI
              </button>
            </div>

            {payMethod === "cod" ? (
              <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                Pay in cash when your order is delivered.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  After paying, take a screenshot of your payment confirmation and upload it below.
                </p>
                {upiQuery.data ? (
                  <Button asChild className="h-14 w-full text-base">
                    <a href={upiLink(upiQuery.data, shop.shop_name, total, `Order at ${shop.shop_name}`)}>
                      <Wallet className="size-5" /> Pay {formatINR(total)} via UPI
                    </a>
                  </Button>
                ) : (
                  <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                    This shop hasn't added a UPI ID yet. Please choose Cash on Delivery.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-32 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-muted p-2 text-sm text-muted-foreground"
                >
                  {screenshot ? (
                    <img src={screenshot} alt="Payment screenshot" className="max-h-56 rounded-lg" />
                  ) : (
                    <>
                      <Upload className="size-6" />
                      Tap to upload payment screenshot
                    </>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 8 * 1024 * 1024) {
                      toast.error("Please choose an image under 8 MB");
                      return;
                    }
                    void compressImageFile(file).then(setScreenshot);
                  }}
                />
              </>
            )}

            <Button
              className="h-14 w-full text-base"
              disabled={busy || (payMethod === "upi" && !screenshot)}
              onClick={() => void place()}
            >
              {busy
                ? "Placing your order..."
                : payMethod === "cod"
                  ? "Place order (Cash on Delivery)"
                  : "Submit order"}
            </Button>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
