export const CATEGORIES = [
  "Patiala Suit",
  "Churidar",
  "Plazo Set",
  "Lehenga",
  "Kurti",
  "Dupatta",
  "Saree",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const STOCK_REASONS = ["restock", "sale", "damage"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export const LOW_STOCK_THRESHOLD = 3;
export const TRYON_DAILY_LIMIT = 3;

export type Shop = {
  id: string;
  user_id: string;
  owner_name: string;
  shop_name: string;
  email: string;
  whatsapp_number: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  shop_id: string;
  product_name: string;
  category: string;
  subcategory: string | null;
  size: string | null;
  color: string | null;
  fabric: string | null;
  quantity: number;
  cost_price: number;
  selling_price: number;
  sku: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function whatsappLink(number: string | null | undefined, message: string) {
  const digits = (number ?? "").replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

const SESSION_KEY = "ves_shopper_session";

export function getShopperSessionId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
