import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { generateTryOn } from "@/lib/tryon.functions";
import { getShopperSessionId, whatsappLink, type Product, type Shop } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  shop: Shop | null;
};

export function TryOnDialog({ open, onOpenChange, product, shop }: Props) {
  const run = useServerFn(generateTryOn);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setLoading(false);
  };

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Please choose a photo under 8 MB");
      return;
    }
    const dataUrl = await readFile(file);
    setPreview(dataUrl);
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
      }
    } catch {
      toast.error("Something went wrong creating your look");
    } finally {
      // The shopper's photo is never stored — it only lived in this request.
      setPreview(null);
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Try it on
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            {preview && (
              <img src={preview} alt="Your upload" className="h-40 rounded-xl object-cover opacity-60" />
            )}
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Creating your look... this can take up to a minute.
            </p>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <img src={result} alt={`You wearing ${product.product_name}`} className="w-full rounded-xl" />
            <Button variant="secondary" className="h-12 w-full text-base" onClick={reset}>
              Try another outfit
            </Button>
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
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
              Upload a clear, front-facing, full-body photo with plain background and good light.
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted text-sm text-muted-foreground"
            >
              <Upload className="size-6" />
              Tap to upload your photo
            </button>
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
              Unlimited free try-ons. Your photo is never saved.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
