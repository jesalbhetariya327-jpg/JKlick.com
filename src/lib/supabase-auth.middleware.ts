import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function createAuthenticatedFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (apiKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

/** Validates the request bearer and exposes an RLS-scoped backend client. */
export const requireAppAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const backendUrl = process.env["SUPABASE_URL"] ?? import.meta.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!backendUrl || !publishableKey) throw new Error("The backend connection is not configured.");

  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice(7);
  if (token.split(".").length !== 3) throw new Error("Unauthorized");

  const supabase = createClient<Database>(backendUrl, publishableKey, {
    global: {
      fetch: createAuthenticatedFetch(publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !data?.claims || !userId) throw new Error("Unauthorized");

  return next({ context: { supabase, userId, claims: data.claims } });
});