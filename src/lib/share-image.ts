/** Browser-only helpers for sharing a generated try-on look. */

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/** Draws the shop name + storefront link along the bottom of the look. */
export async function watermarkLook(
  imageUrl: string,
  shopName: string,
  storefrontUrl: string,
): Promise<Blob | null> {
  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 768;
    canvas.height = img.naturalHeight || 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const barHeight = Math.max(64, Math.round(canvas.height * 0.09));
    const y = canvas.height - barHeight;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, y, canvas.width, barHeight);

    const titleSize = Math.round(barHeight * 0.34);
    const subSize = Math.round(barHeight * 0.24);
    const pad = Math.round(barHeight * 0.22);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.font = `600 ${titleSize}px system-ui, sans-serif`;
    ctx.fillText(shopName, pad, y + pad, canvas.width - pad * 2);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `400 ${subSize}px system-ui, sans-serif`;
    ctx.fillText(storefrontUrl, pad, y + pad + titleSize * 1.2, canvas.width - pad * 2);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92),
    );
  } catch {
    return null;
  }
}

export function canWebShareFiles() {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    const probe = new File([new Blob([""], { type: "image/jpeg" })], "p.jpg", {
      type: "image/jpeg",
    });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
