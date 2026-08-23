import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { getAdminAnalytics } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin analytics | JKlick" },
      {
        name: "description",
        content: "Platform analytics: shop accounts, logins, shoppers and AI try-on usage per shop.",
      },
      { property: "og:title", content: "Admin analytics | JKlick" },
      { property: "og:description", content: "Shop accounts, logins and try-on usage overview." },
    ],
  }),
  component: AdminPage,
  errorComponent: () => <p className="p-6 text-center">This page could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Page not found.</p>,
});

function fmtSeconds(total: number) {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function AdminPage() {
  const fetchAnalytics = useServerFn(getAdminAnalytics);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchAnalytics({}),
    retry: false,
  });

  if (isLoading) return <p className="p-6 text-center text-muted-foreground">Loading...</p>;

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-medium">This page is not available for your account.</p>
        <Link to="/dashboard" className="text-sm underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-6 pt-6 text-primary-foreground">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm opacity-90">
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="size-6" /> Admin analytics
        </h1>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Shop accounts" value={String(data.totalShops)} />
          <Stat label="Products listed" value={String(data.totalProducts)} />
          <Stat label="Active shops" value={String(data.activeShops)} />
          <Stat label="Suspended shops" value={String(data.suspendedShops)} />
          <Stat label="Try-on photos" value={String(data.totalTryOns)} />
          <Stat label="Unique shoppers" value={String(data.totalClients)} />
          <Stat label="Owner logins" value={String(data.totalLogins)} />
          <Stat label="AI time used" value={fmtSeconds(data.totalSeconds)} />
          <Stat label="Orders placed" value={String(data.totalOrders)} />
          <Stat label="Order value" value={formatINR(data.totalOrderValue)} />
        </div>
      </header>

      <main className="space-y-3 px-4 py-5">
        <h2 className="text-sm font-semibold text-muted-foreground">Per shop breakdown</h2>
        {data.perShop.length === 0 && (
          <p className="text-sm text-muted-foreground">No shops yet.</p>
        )}
        {data.perShop.map((row) => (
          <Card key={row.shopId} className="shadow-soft">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.shopName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.ownerName} · /{row.slug}
                  </p>
                </div>
                <Badge variant={row.isActive ? "secondary" : "destructive"}>
                  {row.isActive ? "Active" : "Suspended"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Try-ons" value={String(row.tryOns)} />
                <Metric label="Shoppers" value={String(row.clients)} />
                <Metric label="Products" value={String(row.products)} />
                <Metric label="Logins" value={String(row.logins)} />
                <Metric label="AI time" value={fmtSeconds(row.totalSeconds)} />
                <Metric label="Avg / try-on" value={`${row.avgSeconds}s`} />
                <Metric label="Orders" value={String(row.orders)} />
                <Metric label="Order value" value={formatINR(row.orderValue)} />
              </div>

              <div className="space-y-0.5 text-xs text-muted-foreground">
                <p>Last login: {fmtDate(row.lastLoginAt)}</p>
                <p>Last try-on: {fmtDate(row.lastTryOnAt)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/15 p-3 backdrop-blur">
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <p className="text-base font-semibold text-primary">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
