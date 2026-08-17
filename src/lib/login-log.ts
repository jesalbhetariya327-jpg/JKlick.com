import { supabase } from "@/integrations/supabase/client";

/** Records a shop owner sign-in for admin analytics. Never blocks the login flow. */
export async function recordLogin(userId: string) {
  try {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    await supabase.from("login_log").insert({ user_id: userId, shop_id: shop?.id ?? null });
  } catch {
    /* analytics only */
  }
}
