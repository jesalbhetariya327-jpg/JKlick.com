import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppAuth } from "@/lib/supabase-auth.middleware";

/**
 * Returns a shop's UPI id to the shop owner, or to any signed-in shopper when
 * the shop is active. All checks happen server-side; the column itself stays
 * unreadable through the public API.
 */
export const getShopUpi = createServerFn({ method: "GET" })
  .middleware([requireAppAuth])
  .inputValidator((data) => z.object({ shopId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<string | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("user_id, is_active, upi_id")
      .eq("id", data.shopId)
      .maybeSingle();

    if (!shop) return null;
    if (shop.user_id !== context.userId && !shop.is_active) return null;

    return shop.upi_id ?? null;
  });
