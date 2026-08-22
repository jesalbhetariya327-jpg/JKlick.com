import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://virar-style-magic.lovable.app";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}

export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const { data } = await supabase
          .from("shops")
          .select("slug, created_at")
          .eq("is_active", true);

        const urls = [
          `<url><loc>${SITE_URL}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
          ...(data ?? [])
            .filter((s) => s.slug)
            .map(
              (s) =>
                `<url><loc>${SITE_URL}/${escapeXml(s.slug as string)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
            ),
        ].join("");

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">${urls}</urlset>`,
          { headers: { "content-type": "application/xml; charset=utf-8" } },
        );
      },
    },
  },
});
