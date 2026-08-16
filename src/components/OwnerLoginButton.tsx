import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

/** Small persistent "Shop owner login" button shown in the top-right of public pages. */
export function OwnerLoginButton() {
  return (
    <Link
      to="/auth"
      className="fixed right-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-soft backdrop-blur"
    >
      <Store className="size-4 text-primary" />
      Shop owner login
    </Link>
  );
}
