/**
 * Virtual try-on provider adapter.
 *
 * This is the ONLY file that knows which try-on vendor is used.
 * To switch providers (e.g. FASHN.ai), replace the body of `runTryOn`
 * and read the vendor key from the server environment. Nothing else
 * in the app needs to change.
 */

export type TryOnInput = {
  /** Shopper photo as a data URL. Held in memory only, never persisted. */
  personImage: string;
  /** Garment image as a data URL. */
  garmentImage: string;
  /** Short description of the garment, used by prompt-based providers. */
  garmentDescription: string;
};

export type TryOnResult = { imageUrl: string } | { error: string };

export async function runTryOn(input: TryOnInput): Promise<TryOnResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { error: "Try-on service is not configured." };

  const prompt = [
    "Virtual clothing try-on.",
    "Image 1 is a photo of a person. Image 2 is a garment.",
    `Dress the exact person from image 1 in the garment from image 2 (${input.garmentDescription}).`,
    "Keep the person's face, body shape, skin tone, hair and background unchanged.",
    "Fit the garment naturally with realistic folds, lighting and proportions.",
    "Return a single photorealistic full-body image.",
  ].join(" ");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: input.personImage } },
            { type: "image_url", image_url: { url: input.garmentImage } },
          ],
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (response.status === 429) return { error: "Too many requests right now. Please try again shortly." };
  if (response.status === 402) return { error: "The try-on service is out of credits." };
  if (!response.ok) {
    console.error("try-on provider error", response.status, await response.text());
    return { error: "The try-on service could not create your look." };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
  };
  const url = payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) return { error: "No image was returned. Please try a different photo." };
  return { imageUrl: url };
}
