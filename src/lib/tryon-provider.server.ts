/**
 * Virtual try-on provider adapter — free Hugging Face Space "yisol/IDM-VTON".
 *
 * This is the ONLY file that knows which try-on vendor is used.
 * It talks to the Space through Gradio's queue protocol using @gradio/client.
 * No part of this flow touches the Lovable AI Gateway or consumes Lovable AI
 * credits. Do NOT change the provider/model/API without explicit owner
 * approval (see project memory).
 */

export type TryOnInput = {
  /** Shopper photo as a data URL. Held in memory only, never persisted. */
  personImage: string;
  /** Garment image as a data URL. */
  garmentImage: string;
  /** Short description of the garment, passed through to the Space. */
  garmentDescription: string;
};

export type TryOnResult = { imageUrl: string } | { error: string };

const SPACE_ID = "yisol/IDM-VTON";
/** The free Space can cold-start and queue work, so allow a generous overall budget. */
const OVERALL_TIMEOUT_MS = 120_000;

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("invalid image data");
  const mime = match[1] || "image/jpeg";
  const isBase64 = Boolean(match[2]);
  const body = match[3] ?? "";
  if (!isBase64) {
    return new Blob([decodeURIComponent(body)], { type: mime });
  }
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function classify(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("quota") || m.includes("too many") || m.includes("429")) {
    return "This is a busy free service. Please try again in a few minutes.";
  }
  if (m.includes("gpu") || m.includes("exceeded your") || m.includes("zerogpu")) {
    return "This is a busy free service. Please try again in a few minutes.";
  }
  if (m.includes("sleep") || m.includes("starting") || m.includes("building") || m.includes("space is") || m.includes("503")) {
    return "The free try-on service is waking up. Please try again in about a minute.";
  }
  if (m.includes("401") || m.includes("403") || m.includes("unauthorized") || m.includes("forbidden")) {
    return "The try-on service rejected the request. Please contact the shop.";
  }
  if (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("econn") ||
    m.includes("socket") ||
    m.includes("timeout") ||
    m.includes("aborted")
  ) {
    return "Could not reach the try-on service. Please check your connection and try again.";
  }
  return null;
}

/** Pull an image URL out of whatever shape Gradio returns for result[0]. */
function extractImageUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.startsWith("http") || value.startsWith("data:") ? value : null;
  if (Array.isArray(value)) return extractImageUrl(value[0]);
  if (typeof value === "object") {
    const v = value as { url?: string; path?: string; image?: unknown };
    if (typeof v.url === "string" && v.url) return v.url;
    if (v.image) return extractImageUrl(v.image);
    if (typeof v.path === "string" && v.path.startsWith("http")) return v.path;
  }
  return null;
}

export async function runTryOn(input: TryOnInput): Promise<TryOnResult> {
  const hfToken = process.env["HF_TOKEN"];
  const startedAt = Date.now();

  let personBlob: Blob;
  let garmentBlob: Blob;
  try {
    personBlob = dataUrlToBlob(input.personImage);
    garmentBlob = dataUrlToBlob(input.garmentImage);
  } catch {
    console.error("try-on image decode failed");
    return { error: "That photo could not be read. Please try another one." };
  }

  console.info("try-on provider started", {
    personBytes: personBlob.size,
    garmentBytes: garmentBlob.size,
    authenticated: Boolean(hfToken),
  });

  // New seed on every call so repeat try-ons of the same garment differ.
  const seed = Math.floor(Math.random() * 2_147_483_647);

  const work = (async (): Promise<TryOnResult> => {
    const { Client } = await import("@gradio/client");

    let client: Awaited<ReturnType<typeof Client.connect>>;
    try {
      client = await Client.connect(
        SPACE_ID,
        hfToken ? { hf_token: hfToken as `hf_${string}` } : {},
      );
      console.info("try-on provider connected", { elapsedMs: Date.now() - startedAt });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("try-on connect failed", message);
      return {
        error:
          classify(message) ??
          "The free try-on service is waking up. Please try again in about a minute.",
      };
    }

    let result: unknown;
    try {
      const response = await client.predict("/tryon", {
        dict: { background: personBlob, layers: [], composite: null },
        garm_img: garmentBlob,
        garment_des: input.garmentDescription || "garment",
        is_checked: true,
        is_checked_crop: true,
        denoise_steps: 30,
        seed,
      });
      result = (response as { data?: unknown }).data;
      console.info("try-on prediction returned", { elapsedMs: Date.now() - startedAt });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("try-on predict failed", message);
      return {
        error: classify(message) ?? "The try-on service could not create your look. Please try again.",
      };
    }

    if (!Array.isArray(result) || result.length === 0) {
      console.error("try-on malformed response", JSON.stringify(result)?.slice(0, 500));
      return { error: "The try-on service returned an unexpected result. Please try again." };
    }

    // result[0] is the try-on image; result[1] is a debug mask we never show.
    const imageUrl = extractImageUrl(result[0]);
    if (!imageUrl) {
      console.error("try-on missing image", JSON.stringify(result[0])?.slice(0, 500));
      return { error: "No image was returned. Please try a different photo." };
    }
    console.info("try-on provider completed", { elapsedMs: Date.now() - startedAt });
    return { imageUrl };
  })();

  const timeout = new Promise<TryOnResult>((resolve) =>
    setTimeout(
      () =>
        resolve({
          error: "The try-on service is taking too long right now. Please try again in a few minutes.",
        }),
      OVERALL_TIMEOUT_MS,
    ),
  );

  return Promise.race([work, timeout]);
}
