import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { escapeHtml } from "./html-escape";

const schema = z.object({
  shopName: z.string().trim().max(200),
  ownerName: z.string().trim().max(200),
  email: z.string().trim().max(320),
  phone: z.string().trim().max(40).nullable(),
});

const ADMIN_NOTIFY_EMAIL = "socialguy327@gmail.com";

/** Emails the platform admin whenever a new shop signs up.
 *  Requires a verified sending domain (RESEND_API_KEY + NOTIFY_FROM_EMAIL). */
export const notifyNewSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["NOTIFY_FROM_EMAIL"];
    if (!apiKey || !from) {
      console.warn("[signup-notify] Email sending is not configured yet.", {
        shop: data.shopName,
      });
      return { sent: false as const };
    }

    const html = `
      <h2>New shop signed up on JKlick</h2>
      <ul>
        <li><strong>Shop name:</strong> ${escapeHtml(data.shopName)}</li>
        <li><strong>Owner name:</strong> ${escapeHtml(data.ownerName)}</li>
        <li><strong>Email:</strong> ${escapeHtml(data.email)}</li>
        <li><strong>Phone:</strong> ${escapeHtml(data.phone ?? "-")}</li>
      </ul>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [ADMIN_NOTIFY_EMAIL],
          subject: `New shop signup: ${data.shopName}`,
          html,
        }),
      });
      if (!res.ok) {
        console.error("[signup-notify] send failed", res.status);
        return { sent: false as const };
      }
      return { sent: true as const };
    } catch {
      return { sent: false as const };
    }
  });
