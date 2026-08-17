import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ShopAnalytics = {
  shopId: string;
  shopName: string;
  ownerName: string;
  slug: string;
  isActive: boolean;
  products: number;
  tryOns: number;
  /** Distinct shopper devices that generated a try-on for this shop. */
  clients: number;
  /** Total AI generation time spent for this shop, in seconds. */
  totalSeconds: number;
  /** Average AI generation time per try-on, in seconds. */
  avgSeconds: number;
  logins: number;
  lastLoginAt: string | null;
  lastTryOnAt: string | null;
};

export type AdminAnalytics = {
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  totalProducts: number;
  totalTryOns: number;
  totalClients: number;
  totalLogins: number;
  totalSeconds: number;
  perShop: ShopAnalytics[];
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

    const [{ data: shops }, { data: logs }, { data: logins }, { data: products }] =
      await Promise.all([
        supabaseAdmin
          .from("shops")
          .select("id, shop_name, owner_name, slug, is_active")
          .order("created_at", { ascending: true }),
        supabaseAdmin.from("tryon_log").select("shop_id, session_id, duration_ms, created_at"),
        supabaseAdmin.from("login_log").select("shop_id, created_at"),
        supabaseAdmin.from("products").select("shop_id"),
      ]);

    type Agg = {
      tryOns: number;
      ms: number;
      clients: Set<string>;
      logins: number;
      products: number;
      lastLoginAt: string | null;
      lastTryOnAt: string | null;
    };
    const agg = new Map<string, Agg>();
    const blank = (): Agg => ({
      tryOns: 0,
      ms: 0,
      clients: new Set(),
      logins: 0,
      products: 0,
      lastLoginAt: null,
      lastTryOnAt: null,
    });
    const at = (id: string) => {
      let row = agg.get(id);
      if (!row) {
        row = blank();
        agg.set(id, row);
      }
      return row;
    };

    const allClients = new Set<string>();
    let totalMs = 0;

    for (const row of logs ?? []) {
      totalMs += row.duration_ms ?? 0;
      if (row.session_id) allClients.add(row.session_id);
      if (!row.shop_id) continue;
      const entry = at(row.shop_id);
      entry.tryOns += 1;
      entry.ms += row.duration_ms ?? 0;
      if (row.session_id) entry.clients.add(row.session_id);
      if (!entry.lastTryOnAt || row.created_at > entry.lastTryOnAt) entry.lastTryOnAt = row.created_at;
    }

    for (const row of logins ?? []) {
      if (!row.shop_id) continue;
      const entry = at(row.shop_id);
      entry.logins += 1;
      if (!entry.lastLoginAt || row.created_at > entry.lastLoginAt) entry.lastLoginAt = row.created_at;
    }

    for (const row of products ?? []) {
      at(row.shop_id).products += 1;
    }

    const list = shops ?? [];
    const perShop: ShopAnalytics[] = list.map((s) => {
      const entry = agg.get(s.id) ?? blank();
      const seconds = entry.ms / 1000;
      return {
        shopId: s.id,
        shopName: s.shop_name,
        ownerName: s.owner_name,
        slug: s.slug,
        isActive: s.is_active,
        products: entry.products,
        tryOns: entry.tryOns,
        clients: entry.clients.size,
        totalSeconds: Math.round(seconds),
        avgSeconds: entry.tryOns ? Math.round((seconds / entry.tryOns) * 10) / 10 : 0,
        logins: entry.logins,
        lastLoginAt: entry.lastLoginAt,
        lastTryOnAt: entry.lastTryOnAt,
      };
    });

    return {
      totalShops: list.length,
      activeShops: list.filter((s) => s.is_active).length,
      suspendedShops: list.filter((s) => !s.is_active).length,
      totalProducts: products?.length ?? 0,
      totalTryOns: logs?.length ?? 0,
      totalClients: allClients.size,
      totalLogins: logins?.length ?? 0,
      totalSeconds: Math.round(totalMs / 1000),
      perShop: perShop.sort((a, b) => b.tryOns - a.tryOns),
    };
  });
