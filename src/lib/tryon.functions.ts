import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string().min(8).max(100),
  productId: z.string().uuid(),
  // Shopper selfie as a data URL. Kept in memory for this request only.
  personImage: z.string().min(100).max(12_000_000),
});

export const generateTryOn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runTryOn } = await import("./tryon-provider.server");

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("product_name, category, color, fabric, photo_url")
      .eq("id", data.productId)
      .maybeSingle();

    if (!product?.photo_url) return { error: "This product has no photo to try on." };

    let garmentImage: string;
    try {
      const res = await fetch(product.photo_url);
      if (!res.ok) throw new Error(String(res.status));
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const base64 = Buffer.from(buffer).toString("base64");
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
