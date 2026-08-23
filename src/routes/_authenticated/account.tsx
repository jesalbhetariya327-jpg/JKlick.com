import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Package, Trash2, UserRound } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { deleteSavedTryOn, listSavedTryOns } from "@/lib/customer.functions";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My saved try-ons | JKlick" },
      {
        name: "description",
        content: "Your private saved AI try-on photos and JKlick shopper account.",
      },
      { property: "og:title", content: "My saved try-ons | JKlick" },
      { property: "og:description", content: "Saved try-on photos, visible only to you." },
    ],
  }),
  component: AccountPage,
  errorComponent: () => <p className="p-6 text-center">This page could not be loaded.</p>,
  notFoundComponent: () => <p className="p-6 text-center">Page not found.</p>,
});

function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchSaved = useServerFn(listSavedTryOns);
  const removeSaved = useServerFn(deleteSavedTryOn);
  const [deleting, setDeleting] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["my-customer-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("customers")
        .select("user_id, full_name, phone, email")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const savedQuery = useQuery({
    queryKey: ["saved-tryons"],
    queryFn: () => fetchSaved({}),
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    const res = await removeSaved({ data: { id: deleting } });
    setDeleting(null);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Photo deleted");
    void queryClient.invalidateQueries({ queryKey: ["saved-tryons"] });
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/customer-login", replace: true });
  };

  const saved = savedQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-royal px-4 pb-6 pt-6 text-primary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">My account</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <UserRound className="size-6" /> {profileQuery.data?.full_name ?? "Shopper"}
            </h1>
          </div>
          <Button size="icon" variant="secondary" onClick={() => void signOut()} aria-label="Log out">
            <LogOut className="size-4" />
          </Button>
        </div>
        <Link
          to="/my-orders"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1.5 text-sm backdrop-blur"
        >
          <Package className="size-4" /> My orders
        </Link>
      </header>

      <main className="space-y-3 px-4 py-5">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Saved try-on photos (only you can see these)
        </h2>

        {savedQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!savedQuery.isLoading && saved.length === 0 && (
          <Card className="shadow-soft">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              You haven't saved any try-on photos yet. Generate a look on any product page and tap
              "Save to my account".
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {saved.map((look) => (
            <div key={look.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              {look.imageUrl && (
                <img
                  src={look.imageUrl}
                  alt={`You wearing ${look.productName}`}
                  className="aspect-[3/4] w-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="flex items-center gap-2 p-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{look.productName}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 text-destructive"
                  onClick={() => setDeleting(look.id)}
                  aria-label="Delete saved photo"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this saved photo?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be permanently removed from your account.
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
