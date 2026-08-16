import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { getAdminAnalytics } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin analytics | Virar Ethnic Stock" },
      {
        name: "description",
        content: "Platform analytics: shop accounts, suspensions and AI try-on usage per shop.",
      },
      { property: "og:title", content: "Admin analytics | Virar Ethnic Stock" },
      { property: "og:description", content: "Shop accounts and try-on usage overview." },
    ],
  }),
  component: AdminPage,
  errorComponent: () => <p className="p-6 text-center">This page could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Page not found.</p>,
});

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
          <Stat label="Shop accounts" value={data.totalShops} />
          <Stat label="Try-ons generated" value={data.totalTryOns} />
          <Stat label="Active shops" value={data.activeShops} />
          <Stat label="Suspended shops" value={data.suspendedShops} />
        </div>
      </header>

      <main className="space-y-3 px-4 py-5">
        <h2 className="text-sm font-semibold text-muted-foreground">Try-ons per shop</h2>
        {data.perShop.length === 0 && (
          <p className="text-sm text-muted-foreground">No shops yet.</p>
        )}
        {data.perShop.map((row) => (
          <Card key={row.shopId} className="shadow-soft">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.shopName}</p>
                <Badge variant={row.isActive ? "secondary" : "destructive"} className="mt-1">
                  {row.isActive ? "Active" : "Suspended"}
                </Badge>
              </div>
              <p className="text-xl font-bold text-primary">{row.tryOns}</p>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-background/15 p-3 backdrop-blur">
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
