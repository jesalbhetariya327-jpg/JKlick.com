import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { listShopOrders, updateOrderStatus, ORDER_STATUSES } from "@/lib/orders.functions";
import { formatINR } from "@/lib/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusTone } from "./my-orders";

export const Route = createFileRoute("/_authenticated/shop-orders")({
  head: () => ({
    meta: [
      { title: "Orders | JKlick" },
      {
        name: "description",
        content: "Incoming customer orders for your shop with payment screenshots and status.",
      },
      { property: "og:title", content: "Orders | JKlick" },
      { property: "og:description", content: "Manage incoming orders and payment proofs." },
    ],
  }),
  component: ShopOrders,
  errorComponent: () => <p className="p-6 text-center">Orders could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Page not found.</p>,
});

function ShopOrders() {
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(listShopOrders);
  const setStatus = useServerFn(updateOrderStatus);

  const { data, isLoading } = useQuery({ queryKey: ["shop-orders"], queryFn: () => fetchOrders({}) });
  const orders = data ?? [];

  const change = async (orderId: string, status: (typeof ORDER_STATUSES)[number]) => {
    const res = await setStatus({ data: { orderId, status } });
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Order marked ${status}`);
    void queryClient.invalidateQueries({ queryKey: ["shop-orders"] });
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-6 pt-6 text-primary-foreground">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm opacity-90">
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="size-6" /> Orders
        </h1>
      </header>

      <main className="space-y-3 px-4 py-5">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && orders.length === 0 && (
          <Card className="shadow-soft">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No orders yet.
            </CardContent>
          </Card>
        )}

        {orders.map((order) => (
          <Card key={order.id} className="shadow-soft">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{order.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[order.customerPhone, order.customerEmail].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={statusTone(order.status)}>{order.status}</Badge>
              </div>

              <ul className="space-y-1 text-sm">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="shrink-0">{formatINR(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-right font-bold text-primary">{formatINR(order.totalAmount)}</p>

              <div className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                <p className="font-semibold">
                  {order.paymentMethod === "cod" ? "Cash on Delivery" : "Paid online via UPI"}
                </p>
                {order.deliveryAddress && (
                  <p className="mt-1 whitespace-pre-wrap">{order.deliveryAddress}</p>
                )}
              </div>


              {order.screenshotUrl && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    Payment screenshot
                  </p>
                  <a href={order.screenshotUrl} target="_blank" rel="noreferrer">
                    <img
                      src={order.screenshotUrl}
                      alt="Payment screenshot"
                      className="max-h-64 rounded-xl border border-border"
                      loading="lazy"
                    />
                  </a>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "cancelled" ? "outline" : "secondary"}
                    onClick={() => void change(order.id, s)}
                  >
                    Mark {s}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
