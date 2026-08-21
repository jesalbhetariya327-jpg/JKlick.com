import { useSyncExternalStore } from "react";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  photoUrl: string | null;
};

export type CartMap = Record<string, CartItem[]>;

const KEY = "ves_cart_v1";

let cache: CartMap | null = null;
const listeners = new Set<() => void>();

function read(): CartMap {
  if (typeof window === "undefined") return {};
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as CartMap;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: CartMap) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addToCart(shopId: string, item: Omit<CartItem, "qty">, qty = 1) {
  const carts = { ...read() };
  const list = [...(carts[shopId] ?? [])];
  const found = list.findIndex((i) => i.productId === item.productId);
  if (found >= 0) list[found] = { ...list[found]!, qty: list[found]!.qty + qty };
  else list.push({ ...item, qty });
  carts[shopId] = list;
  write(carts);
}

export function setQty(shopId: string, productId: string, qty: number) {
  const carts = { ...read() };
  const list = (carts[shopId] ?? [])
    .map((i) => (i.productId === productId ? { ...i, qty } : i))
    .filter((i) => i.qty > 0);
  if (list.length) carts[shopId] = list;
  else delete carts[shopId];
  write(carts);
}

export function clearCart(shopId: string) {
  const carts = { ...read() };
  delete carts[shopId];
  write(carts);
}

const EMPTY: CartItem[] = [];

export function useCart(shopId: string | null | undefined) {
  const carts = useSyncExternalStore(
    subscribe,
    () => read(),
    () => ({}) as CartMap,
  );
  const items = (shopId ? carts[shopId] : undefined) ?? EMPTY;
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  return { items, total, count };
}

/** Builds a UPI deep link that opens the shopper's installed UPI apps. */
export function upiLink(upiId: string, payeeName: string, amount: number, note?: string) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
  });
  if (note) params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}
