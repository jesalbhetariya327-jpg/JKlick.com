import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Heart, Loader2, Share2, Sparkles, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { generateTryOn } from "@/lib/tryon.functions";
import { saveTryOn } from "@/lib/customer.functions";
import { supabase } from "@/integrations/supabase/client";
import { getShopperSessionId, whatsappLink, type Product, type Shop } from "@/lib/catalog";
import {
  addLook,
  clearTryOnSession,
  getPersonImage,
  setPersonImage,
  useTryOnSession,
} from "@/lib/tryon-session";
import { canWebShareFiles, downloadBlob, watermarkLook } from "@/lib/share-image";
import { compressImageFile } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  shop: Shop | null;
};

const MAX_WAIT_SECONDS = 120;

export function TryOnDialog({ open, onOpenChange, product, shop }: Props) {
  const run = useServerFn(generateTryOn);
  const fileRef = useRef<HTMLInputElement>(null);
  const { personImage, looks } = useTryOnSession();
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLook, setSavedLook] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const persist = useServerFn(saveTryOn);

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [open]);

  useEffect(() => {
    setSavedLook(false);
  }, [result]);

  const saveToAccount = async () => {
    if (!result) return;
    setSaving(true);
    const res = await persist({
      data: {
        productId: product.id,
        shopId: shop?.id ?? null,
        productName: product.product_name,
        image: result,
      },
    });
    setSaving(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    setSavedLook(true);
    toast.success("Saved to your account");
  };

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const generate = async (dataUrl: string) => {
    setResult(null);
    setLoading(true);
    try {
      const response = await run({
        data: {
          sessionId: getShopperSessionId(),
          productId: product.id,
          personImage: dataUrl,
        },
      });
      if ("error" in response && response.error) {
        toast.error(response.error);
      } else if ("imageUrl" in response && response.imageUrl) {
        setResult(response.imageUrl);
        addLook({
          id: crypto.randomUUID(),
          productId: product.id,
          productName: product.product_name,
          imageUrl: response.imageUrl,
        });
      }
    } catch {
      toast.error("Something went wrong creating your look");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid photo");
      return;
    }
    try {
      const dataUrl = await compressImageFile(file, 1400, 0.75);
      if (!dataUrl.startsWith("data:image/") || dataUrl.length > 12_000_000) {
        toast.error("This photo is still too large. Please choose a different photo.");
        return;
      }
      // Kept in this tab's memory only — never saved anywhere.
      setPersonImage(dataUrl);
      await generate(dataUrl);
    } catch {
      toast.error("That photo could not be read. Please try another one.");
    }
  };

  const storefrontUrl =
    typeof window !== "undefined" && shop ? `${window.location.host}/${shop.slug}` : "";

  const share = async () => {
    if (!result) return;
    setSharing(true);
    try {
      const blob =
        (await watermarkLook(result, shop?.shop_name ?? "JKlick", storefrontUrl)) ??
        (await (await fetch(result)).blob());
      const filename = `${product.product_name.replace(/\W+/g, "-").toLowerCase()}-tryon.jpg`;
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      if (canWebShareFiles()) {
        await navigator.share({
          files: [file],
          title: product.product_name,
          text: `${product.product_name} from ${shop?.shop_name ?? "our shop"} — ${storefrontUrl}`,
        });
      } else {
        downloadBlob(blob, filename);
        toast.success("Image downloaded");
      }
    } catch {
      // User cancelled the share sheet, or the image could not be prepared.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Try it on
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            {personImage && (
              <img
                src={personImage}
                alt="Your upload"
                className="h-40 rounded-xl object-cover opacity-60"
              />
            )}
            <Loader2 className="size-8 animate-spin text-primary" />
            <div className="w-full space-y-2">
              <p className="text-sm font-medium">
                {elapsed >= 60
                  ? "Still working — busy right now, hang tight a little longer"
                  : "Creating your look... this can take up to a minute."}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{
                    width: `${Math.min(95, (elapsed / MAX_WAIT_SECONDS) * 100).toFixed(0)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {elapsed}s elapsed · the free try-on service can take up to {MAX_WAIT_SECONDS} seconds
              </p>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <img
              src={result}
              alt={`You wearing ${product.product_name}`}
              className="w-full rounded-xl"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-12 text-base"
                disabled={sharing}
                onClick={() => void share()}
              >
                {canWebShareFiles() ? (
                  <Share2 className="size-4" />
                ) : (
                  <Download className="size-4" />
                )}
                {canWebShareFiles() ? "Share" : "Download"}
              </Button>
              <Button
                variant="secondary"
                className="h-12 text-base"
                onClick={() => {
                  const saved = getPersonImage();
                  if (saved) void generate(saved);
                  else fileRef.current?.click();
                }}
              >
                Try again
              </Button>
            </div>
            {signedIn ? (
              <Button
                variant="outline"
                className="h-12 w-full text-base"
                disabled={saving || savedLook}
                onClick={() => void saveToAccount()}
              >
                <Heart className="size-4" />
                {savedLook ? "Saved to my account" : saving ? "Saving..." : "Save to my account"}
              </Button>
            ) : (
              <Button asChild variant="outline" className="h-12 w-full text-base">
                <Link to="/customer-login">
                  <Heart className="size-4" /> Log in to save this look
                </Link>
              </Button>
            )}
            <Button asChild className="h-12 w-full text-base">
              <a
                href={whatsappLink(
                  shop?.whatsapp_number,
                  `Hi ${shop?.shop_name ?? ""}! I want to buy "${product.product_name}".`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                Contact shop to buy
              </a>
            </Button>
            <LookGallery />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
              Upload a clear, front-facing, full-body photo with plain background and good light.
            </p>

            {personImage ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <img
                    src={personImage}
                    alt="Your photo"
                    className="size-16 rounded-lg object-cover"
                  />
                  <p className="text-sm text-muted-foreground">
                    Using the photo you uploaded this session — no need to upload again.
                  </p>
                </div>
                <Button
                  className="h-12 w-full text-base"
                  onClick={() => void generate(personImage)}
                >
                  Try this outfit on
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="h-10 flex-1 text-sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    Use a different photo
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 flex-1 text-sm"
                    onClick={() => clearTryOnSession()}
                  >
                    Clear my photo
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted text-sm text-muted-foreground"
              >
                <Upload className="size-6" />
                Tap to upload your photo
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            <p className="text-center text-xs text-muted-foreground">
              Unlimited free try-ons. Your photo stays on this device and is never saved.
            </p>
            {looks.length > 0 && <LookGallery />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LookGallery() {
  const { looks } = useTryOnSession();
  if (looks.length < 2) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">
        Your looks this session (cleared when you leave)
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {looks.map((look) => (
          <figure key={look.id} className="w-24 shrink-0">
            <img
              src={look.imageUrl}
              alt={`You wearing ${look.productName}`}
              className="h-32 w-24 rounded-lg object-cover"
              loading="lazy"
            />
            <figcaption className="mt-1 truncate text-[10px] text-muted-foreground">
              {look.productName}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
