import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Package } from "lucide-react";

import { listMyOrders } from "@/lib/orders.functions";
import { formatINR } from "@/lib/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/my-orders")({
  head: () => ({
    meta: [
      { title: "My orders | JKlick" },
      {
        name: "description",
        content: "Track the ethnic wear orders you placed and their current status.",
      },
      { property: "og:title", content: "My orders | JKlick" },
      { property: "og:description", content: "Your order history and current status." },
    ],
  }),
  component: MyOrders,
  errorComponent: () => <p className="p-6 text-center">Your orders could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Page not found.</p>,
});

export function statusTone(status: string) {
  if (status === "confirmed") return "secondary" as const;
  if (status === "completed") return "default" as const;
  if (status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

function MyOrders() {
  const fetchOrders = useServerFn(listMyOrders);
  const { data, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders({}) });
  const orders = data ?? [];

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-6 pt-6 text-primary-foreground">
        <Link to="/account" className="inline-flex items-center gap-1 text-sm opacity-90">
          <ArrowLeft className="size-4" /> My account
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold">
          <Package className="size-6" /> My orders
        </h1>
      </header>

      <main className="space-y-3 px-4 py-5">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && orders.length === 0 && (
          <Card className="shadow-soft">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              You haven't placed any orders yet.
            </CardContent>
          </Card>
        )}

        {orders.map((order) => (
          <Card key={order.id} className="shadow-soft">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{order.shopName}</p>
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
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
