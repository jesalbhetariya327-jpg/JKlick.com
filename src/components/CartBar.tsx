import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import { formatINR } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

/** Sticky bottom bar showing this shop's bag with a link to checkout. */
export function CartBar({ shopId }: { shopId: string; shopSlug?: string }) {
  const { count, total } = useCart(shopId);
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
      <Button asChild className="h-14 w-full justify-between text-base">
        <Link to="/checkout/$shopId" params={{ shopId }}>
          <span className="inline-flex items-center gap-2">
            <ShoppingBag className="size-5" />
            {count} item{count > 1 ? "s" : ""} in bag
          </span>
          <span>{formatINR(total)}</span>
        </Link>
      </Button>
    </div>
  );
}
