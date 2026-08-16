import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ShopTryOnCount = {
  shopId: string;
  shopName: string;
  isActive: boolean;
  tryOns: number;
};

export type AdminAnalytics = {
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  totalTryOns: number;
  perShop: ShopTryOnCount[];
};

/** Analytics for admin accounts only. Admin status is checked server-side. */
export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAnalytics> => {
    const { data: adminRow } = await context.supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!adminRow) throw new Error("Not authorised");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: shops } = await supabaseAdmin
      .from("shops")
      .select("id, shop_name, is_active")
      .order("created_at", { ascending: true });

    const { data: logs } = await supabaseAdmin.from("tryon_log").select("shop_id");

    const counts = new Map<string, number>();
    let totalTryOns = 0;
    for (const row of logs ?? []) {
      totalTryOns += 1;
      if (row.shop_id) counts.set(row.shop_id, (counts.get(row.shop_id) ?? 0) + 1);
    }

    const list = shops ?? [];
    return {
      totalShops: list.length,
      activeShops: list.filter((s) => s.is_active).length,
      suspendedShops: list.filter((s) => !s.is_active).length,
      totalTryOns,
      perShop: list
        .map((s) => ({
          shopId: s.id,
          shopName: s.shop_name,
          isActive: s.is_active,
          tryOns: counts.get(s.id) ?? 0,
        }))
        .sort((a, b) => b.tryOns - a.tryOns),
    };
  });
