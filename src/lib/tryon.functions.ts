import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string().min(8).max(100),
  productId: z.string().uuid(),
  // Shopper selfie as a data URL. Kept in memory for this request only.
  personImage: z.string().min(100).max(12_000_000),
});

/** Generous per-device daily ceiling. High enough that real shoppers never hit it,
 *  low enough to stop scripted abuse of paid AI credits. */
const TRYON_ABUSE_LIMIT = 40;

/** Only images served from this project's own storage may be fetched server-side (SSRF guard). */
function isAllowedProductPhoto(url: string): boolean {
  const base = process.env["SUPABASE_URL"];
  if (!base) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const allowed = new URL(base);
  if (parsed.host !== allowed.host) return false;
  return parsed.pathname.startsWith("/storage/v1/object/");
}

/** Extract the object path inside the product-photos bucket from a storage URL. */
function storagePathFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const marker = "/product-photos/";
    const index = pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export const generateTryOn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runTryOn } = await import("./tryon-provider.server");

    // Server-side abuse guard, tracked per browser session per day.
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabaseAdmin
      .from("tryon_usage")
      .select("id, count")
      .eq("session_id", data.sessionId)
      .eq("usage_date", today)
      .maybeSingle();

    if ((usage?.count ?? 0) >= TRYON_ABUSE_LIMIT) {
      return { error: "You've reached today's try-on limit. Please come back tomorrow." };
    }

    if (usage) {
      await supabaseAdmin
        .from("tryon_usage")
        .update({ count: usage.count + 1, updated_at: new Date().toISOString() })
        .eq("id", usage.id);
    } else {
      await supabaseAdmin
        .from("tryon_usage")
        .insert({ session_id: data.sessionId, usage_date: today, count: 1 });
    }

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("product_name, category, color, fabric, photo_url")
      .eq("id", data.productId)
      .maybeSingle();

    if (!product?.photo_url) return { error: "This product has no photo to try on." };
    if (!isAllowedProductPhoto(product.photo_url)) {
      return { error: "This product photo cannot be used for try-on." };
    }

    let garmentImage: string;
    try {
      const objectPath = storagePathFromUrl(product.photo_url);
      let blob: Blob | null = null;

      if (objectPath) {
        const { data: file } = await supabaseAdmin.storage
          .from("product-photos")
          .download(objectPath);
        blob = file ?? null;
      }

      if (!blob) {
        const res = await fetch(product.photo_url, { redirect: "error" });
        if (!res.ok) throw new Error(String(res.status));
        blob = await res.blob();
      }

      const contentType = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      garmentImage = `data:${contentType};base64,${base64}`;
    } catch {
      return { error: "Could not load the product photo." };
    }


    const description = [product.color, product.fabric, product.category, product.product_name]
      .filter(Boolean)
      .join(" ");

    const result = await runTryOn({
      personImage: data.personImage,
      garmentImage,
      garmentDescription: description,
    });

    if ("error" in result) return { error: result.error };

    return { imageUrl: result.imageUrl };
  });
