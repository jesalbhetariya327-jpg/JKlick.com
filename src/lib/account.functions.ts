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

/** Emails a password reset link to the account matching an email or phone number. */
export const sendPasswordResetLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => identifierSchema.parse(data))
  .handler(async ({ data }) => {
    let target: URL;
    try {
      target = new URL(data.redirectTo);
    } catch {
      return { ok: false as const, message: "Invalid reset link target." };
    }
    if (target.pathname !== "/reset-password" || !["http:", "https:"].includes(target.protocol)) {
      return { ok: false as const, message: "Invalid reset link target." };
    }

    const email = await resolveEmail(data.identifier);
    if (!email) {
      return { ok: false as const, message: "No account found for that email or phone number." };
    }

    const supabase = await publishableClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: target.toString(),
    });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, maskedEmail: maskEmail(email) };
  });

