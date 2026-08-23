import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ORDER_STATUSES = ["requested", "confirmed", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItemView = {
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type OrderView = {
  id: string;
  shopId: string;
  shopName: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  screenshotUrl: string | null;
  items: OrderItemView[];
};

function decodeDataUrl(value: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(value);
  if (!match) return null;
  return { contentType: match[1]!, bytes: Buffer.from(match[2]!, "base64") };
}

const createSchema = z.object({
  shopId: z.string().uuid(),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().max(40).nullable(),
  deliveryAddress: z.string().trim().min(5).max(600),
  paymentMethod: z.enum(["upi", "cod"]),
  screenshot: z
    .string()
    .min(100)
    .max(12_000_000)
    .refine((v) => v.startsWith("data:image/"), "Upload an image screenshot")
    .nullable(),
});


/** Creates an order for the signed-in customer with a payment screenshot. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const decoded = decodeDataUrl(data.screenshot);
    if (!decoded) return { error: "Please upload a valid payment screenshot." };

    // Prices always come from the database, never from the browser.
    const { data: products } = await context.supabase
      .from("products")
      .select("id, product_name, selling_price, shop_id")
      .in(
        "id",
        data.items.map((i) => i.productId),
      );

    const rows = (products ?? []).filter((p) => p.shop_id === data.shopId);
    if (rows.length === 0) return { error: "These products are no longer available." };

    const items = data.items
      .map((i) => {
        const product = rows.find((p) => p.id === i.productId);
        if (!product) return null;
        return {
          product_id: product.id,
          product_name: product.product_name,
          quantity: i.quantity,
          unit_price: Number(product.selling_price),
        };
      })
      .filter((i): i is NonNullable<typeof i> => !!i);

    if (items.length === 0) return { error: "These products are no longer available." };
    const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = decoded.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const path = `${context.userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-screenshots")
      .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
    if (uploadError) return { error: "Could not upload your screenshot. Please try again." };

    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        customer_id: context.userId,
        shop_id: data.shopId,
        total_amount: total,
        payment_screenshot_path: path,
        status: "requested",
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        customer_email: (context.claims as { email?: string } | null)?.email ?? null,
      })
      .select("id")
      .single();

    if (error || !order) {
      await supabaseAdmin.storage.from("payment-screenshots").remove([path]);
      return { error: "Could not place your order. Please try again." };
    }

    const { error: itemsError } = await context.supabase
      .from("order_items")
      .insert(items.map((i) => ({ ...i, order_id: order.id })));
    if (itemsError) return { error: "Could not save your order items." };

    return {
      ok: true as const,
      orderId: order.id,
      total,
      items: items.map((i) => ({
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
    };
  });

type Row = {
  id: string;
  shop_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  payment_screenshot_path: string | null;
};

async function hydrate(
  supabase: { from: (t: string) => any },
  rows: Row[],
  shopNames: Map<string, string>,
  withScreenshots: boolean,
): Promise<OrderView[]> {
  if (rows.length === 0) return [];
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, product_name, quantity, unit_price")
    .in(
      "order_id",
      rows.map((r) => r.id),
    );

  let signedByPath = new Map<string, string>();
  if (withScreenshots) {
    const paths = rows.map((r) => r.payment_screenshot_path).filter((p): p is string => !!p);
    if (paths.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("payment-screenshots")
        .createSignedUrls(paths, 60 * 60);
      signedByPath = new Map(paths.map((p, i) => [p, signed?.[i]?.signedUrl ?? ""]));
    }
  }

  return rows.map((r) => ({
    id: r.id,
    shopId: r.shop_id,
    shopName: shopNames.get(r.shop_id) ?? "Shop",
    totalAmount: Number(r.total_amount),
    status: r.status as OrderStatus,
    createdAt: r.created_at,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    screenshotUrl: r.payment_screenshot_path
      ? (signedByPath.get(r.payment_screenshot_path) ?? null)
      : null,
    items: ((items ?? []) as { order_id: string; product_name: string; quantity: number; unit_price: number }[])
      .filter((i) => i.order_id === r.id)
      .map((i) => ({
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
      })),
  }));
}

/** Order history for the signed-in customer only. */
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrderView[]> => {
    const { data } = await context.supabase
      .from("orders")
      .select(
        "id, shop_id, total_amount, status, created_at, customer_name, customer_phone, customer_email, payment_screenshot_path",
      )
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Row[];
    const { data: shops } = await context.supabase
      .from("shops")
      .select("id, shop_name")
      .in("id", [...new Set(rows.map((r) => r.shop_id))]);

    return hydrate(
      context.supabase as never,
      rows,
      new Map((shops ?? []).map((s) => [s.id, s.shop_name])),
      false,
    );
  });

/** Orders for the signed-in shop owner's own shop only. */
export const listShopOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrderView[]> => {
    const { data: shop } = await context.supabase
      .from("shops")
      .select("id, shop_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!shop) return [];

    const { data } = await context.supabase
      .from("orders")
      .select(
        "id, shop_id, total_amount, status, created_at, customer_name, customer_phone, customer_email, payment_screenshot_path",
      )
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false });

    return hydrate(
      context.supabase as never,
      (data ?? []) as Row[],
      new Map([[shop.id, shop.shop_name]]),
      true,
    );
  });

/** Shop owners update the status of their own shop's orders. */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().uuid(), status: z.enum(ORDER_STATUSES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.orderId);
    if (error) return { error: "Could not update this order." };
    return { ok: true as const };
  });
