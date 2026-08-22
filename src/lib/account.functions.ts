import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identifierSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  redirectTo: z.string().trim().url().max(500),
});


function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "your email";
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

/** Resolves an email or phone number to the shop owner's email address. */
async function resolveEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier.toLowerCase();
  const digits = identifier.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const last10 = digits.slice(-10);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("shops")
    .select("email, whatsapp_number")
    .not("whatsapp_number", "is", null);
  if (error || !data) return null;

  const match = data.find(
    (row) => (row.whatsapp_number ?? "").replace(/\D/g, "").slice(-10) === last10,
  );
  return match?.email?.toLowerCase() ?? null;
}

async function publishableClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Sends a 6-digit email OTP to the account matching an email or phone number. */
export const requestPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => identifierSchema.parse(data))
  .handler(async ({ data }) => {
    const email = await resolveEmail(data.identifier);
    if (!email) return { ok: false as const, message: "No shop account found for that email or phone number." };

    const supabase = await publishableClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, maskedEmail: maskEmail(email) };
  });

/** Verifies the email OTP and returns session tokens for the client to adopt. */
export const verifyPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    const email = await resolveEmail(data.identifier);
    if (!email) return { ok: false as const, message: "No shop account found for that email or phone number." };

    const supabase = await publishableClient();
    const { data: result, error } = await supabase.auth.verifyOtp({
      email,
      token: data.token,
      type: "email",
    });
    if (error || !result.session) {
      return { ok: false as const, message: error?.message ?? "That code is not valid." };
    }
    return {
      ok: true as const,
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    };
  });
