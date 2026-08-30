/**
 * Virtual try-on provider adapter — Hugging Face Space.
 *
 * This is the ONLY file that knows which try-on vendor is used.
 * It calls a free Hugging Face Space directly over HTTP, authenticated
 * with an HF_TOKEN. No part of this flow touches the Lovable AI Gateway
 * or consumes Lovable AI credits.
 *
 * To switch providers, replace the body of `runTryOn` and read the vendor
 * key from the server environment. Do NOT change this to call
 * ai.gateway.lovable.dev or any Lovable AI credit-consuming service
 * without explicit owner approval (see project memory).
 */

export type TryOnInput = {
  /** Shopper photo as a data URL. Held in memory only, never persisted. */
  personImage: string;
  /** Garment image as a data URL. */
  garmentImage: string;
  /** Short description of the garment, passed through to prompt-based Spaces. */
  garmentDescription: string;
};

export type TryOnResult = { imageUrl: string } | { error: string };

/**
 * Calls the configured Hugging Face Space directly.
 *
 * Configuration (read from server env):
 *   - HF_SPACE_URL:  full endpoint URL of the Space's try-on API
 *   - HF_TOKEN:      Hugging Face access token (Bearer auth)
 *
 * The caller is expected to confirm both before this is wired up; until then
 * runTryOn returns a clear "not configured" error and makes no HTTP call.
 */
export async function runTryOn(input: TryOnInput): Promise<TryOnResult> {
  const spaceUrl = process.env["HF_SPACE_URL"];
  const hfToken = process.env["HF_TOKEN"];

  if (!spaceUrl || !hfToken) {
    return { error: "The try-on service is not configured yet." };
  }

  let response: Response;
  try {
    response = await fetch(spaceUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        person_image: input.personImage,
        garment_image: input.garmentImage,
        garment_description: input.garmentDescription,
      }),
    });
  } catch {
    return { error: "The try-on service is not responding. Please try again shortly." };
  }

  if (response.status === 429) {
    return { error: "Too many requests right now. Please try again shortly." };
  }
  if (response.status === 401 || response.status === 403) {
    return { error: "The try-on service rejected the request. Please contact the shop." };
  }
  if (!response.ok) {
    console.error("try-on provider error", response.status, await response.text());
    return { error: "The try-on service could not create your look." };
  }

  // The Space is expected to return JSON with an `image` field holding either
  // a data URL or a URL string. Adjust the parser below to match the Space's
  // actual response shape once the endpoint is confirmed.
  const payload = (await response.json()) as {
    image?: string;
    image_url?: string;
    url?: string;
    output?: string;
    error?: string;
  };

  if (payload.error) return { error: payload.error };

  const imageUrl =
    payload.image ?? payload.image_url ?? payload.url ?? payload.output ?? undefined;

  if (!imageUrl) {
    return { error: "No image was returned. Please try a different photo." };
  }
  return { imageUrl };
}
