import { createFileRoute, Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OwnerLoginButton } from "@/components/OwnerLoginButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JKlick | Ethnic wear with AI try-on" },
      {
        name: "description",
        content:
          "JKlick gives each garment shop its own private storefront link with AI try-on. Open your shop's link to browse their collection.",
      },
      { property: "og:title", content: "JKlick" },
      {
        property: "og:description",
        content: "Each shop has its own private storefront link with AI try-on.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <OwnerLoginButton />
      <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
        <Store className="size-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">JKlick — Ethnic Wear Storefronts with AI Try-On</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Each shop has its own private storefront link. Please open the link shared by the shop you
        want to browse.
      </p>
      <Button asChild className="h-12 w-full max-w-xs text-base">
        <Link to="/auth">Shop owner login</Link>
      </Button>
    </div>
  );
}
