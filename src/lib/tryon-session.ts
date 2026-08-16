import { useSyncExternalStore } from "react";

/**
 * Session-only try-on memory.
 *
 * Lives in a module-level variable inside the browser tab. Nothing here is
 * written to localStorage, sessionStorage or any database — closing the tab
 * or leaving the site clears it completely.
 */

export type TryOnLook = {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string;
};

let personImage: string | null = null;
let looks: TryOnLook[] = [];

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPersonImage(dataUrl: string | null) {
  personImage = dataUrl;
  emit();
}

export function getPersonImage() {
  return personImage;
}

export function addLook(look: TryOnLook) {
  looks = [look, ...looks].slice(0, 12);
  emit();
}

export function clearTryOnSession() {
  personImage = null;
  looks = [];
  emit();
}

const emptyLooks: TryOnLook[] = [];

export function useTryOnSession() {
  const person = useSyncExternalStore(
    subscribe,
    () => personImage,
    () => null,
  );
  const gallery = useSyncExternalStore(
    subscribe,
    () => looks,
    () => emptyLooks,
  );
  return { personImage: person, looks: gallery };
}
