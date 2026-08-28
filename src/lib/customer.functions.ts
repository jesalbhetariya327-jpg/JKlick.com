import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppAuth } from "@/lib/supabase-auth.middleware";

const dataUrl = z
  .string()
  .min(100)
  .max(12_000_000)
  .refine((v) => v.startsWith("data:image/"), "Only image uploads are allowed");

function decodeDataUrl(value: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(value);
  if (!match) return null;
  return {
    contentType: match[1]!,
    bytes: Buffer.from(match[2]!, "base64"),
  };
}

export type SavedTryOn = {
  id: string;
  productId: string | null;
  productName: string;
  createdAt: string;
  imageUrl: string | null;
};

/** Saves a generated try-on into the signed-in customer's own private gallery. */
export const saveTryOn = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        productId: z.string().uuid().nullable(),
        shopId: z.string().uuid().nullable(),
        productName: z.string().trim().max(200).default(""),
        image: dataUrl,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const decoded = decodeDataUrl(data.image);
    if (!decoded) return { error: "That image could not be saved." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = decoded.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const path = `${context.userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("customer-tryons")
      .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
    if (uploadError) return { error: "Could not save this photo. Please try again." };

    const { error } = await context.supabase.from("customer_tryons").insert({
      customer_id: context.userId,
      product_id: data.productId,
      shop_id: data.shopId,
      product_name: data.productName,
      image_path: path,
    });
    if (error) {
      await supabaseAdmin.storage.from("customer-tryons").remove([path]);
      return { error: "Could not save this photo. Please try again." };
    }
    return { ok: true as const };
  });

/** Lists only the signed-in customer's own saved try-ons. */
export const listSavedTryOns = createServerFn({ method: "GET" })
  .middleware([requireAppAuth])
  .handler(async ({ context }): Promise<SavedTryOn[]> => {
    const { data } = await context.supabase
      .from("customer_tryons")
      .select("id, product_id, product_name, image_path, created_at")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false });

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("customer-tryons")
      .createSignedUrls(
        rows.map((r) => r.image_path),
        60 * 60,
      );

    return rows.map((r, i) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      createdAt: r.created_at,
      imageUrl: signed?.[i]?.signedUrl ?? null,
    }));
  });

/** Deletes one saved try-on belonging to the signed-in customer. */
export const deleteSavedTryOn = createServerFn({ method: "POST" })
  .middleware([requireAppAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("customer_tryons")
      .select("id, image_path")
      .eq("id", data.id)
      .eq("customer_id", context.userId)
      .maybeSingle();
    if (!row) return { error: "Photo not found." };

    const { error } = await context.supabase
      .from("customer_tryons")
      .delete()
      .eq("id", data.id)
      .eq("customer_id", context.userId);
    if (error) return { error: "Could not delete this photo." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("customer-tryons").remove([row.image_path]);
    return { ok: true as const };
  });
