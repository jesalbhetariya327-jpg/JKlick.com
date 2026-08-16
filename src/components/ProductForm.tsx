import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Product } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string;
  product: Product | null;
  onSaved: () => void;
};

const empty = {
  product_name: "",
  category: "Kurti",
  subcategory: "",
  size: "",
  color: "",
  fabric: "",
  quantity: "0",
  cost_price: "0",
  selling_price: "0",
  sku: "",
  notes: "",
};

export function ProductForm({ open, onOpenChange, shopId, product, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        product_name: product.product_name,
        category: product.category,
        subcategory: product.subcategory ?? "",
        size: product.size ?? "",
        color: product.color ?? "",
        fabric: product.fabric ?? "",
        quantity: String(product.quantity),
        cost_price: String(product.cost_price),
        selling_price: String(product.selling_price),
        sku: product.sku ?? "",
        notes: product.notes ?? "",
      });
      setPhotoUrl(product.photo_url);
    } else {
      setForm(empty);
      setPhotoUrl(null);
    }
  }, [open, product]);

  const set = (key: keyof typeof empty, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${shopId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-photos").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      setUploading(false);
      toast.error("Could not upload the photo");
      return;
    }
    const { data } = await supabase.storage
      .from("product-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    setPhotoUrl(data?.signedUrl ?? null);
    setUploading(false);
  };

  const save = async () => {
    if (!form.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);
    const payload = {
      shop_id: shopId,
      product_name: form.product_name.trim(),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      size: form.size.trim() || null,
      color: form.color.trim() || null,
      fabric: form.fabric.trim() || null,
      quantity: Number(form.quantity) || 0,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      sku: form.sku.trim() || null,
      notes: form.notes.trim() || null,
      photo_url: photoUrl,
    };

    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(product ? "Product updated" : "Product added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted"
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : photoUrl ? (
              <img src={photoUrl} alt={form.product_name} className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                <ImagePlus className="size-6" />
                Add product photo
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadPhoto(file);
            }}
          />

          <div className="space-y-2">
            <Label>Product name</Label>
            <Input
              className="h-12"
              value={form.product_name}
              onChange={(e) => set("product_name", e.target.value)}
              placeholder="Cotton Patiala set"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subcategory</Label>
              <Input
                className="h-12"
                value={form.subcategory}
                onChange={(e) => set("subcategory", e.target.value)}
                placeholder="Girls / Party"
              />
            </div>
            <div className="space-y-2">
              <Label>Size</Label>
              <Input className="h-12" value={form.size} onChange={(e) => set("size", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input className="h-12" value={form.color} onChange={(e) => set("color", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fabric</Label>
              <Input className="h-12" value={form.fabric} onChange={(e) => set("fabric", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input className="h-12" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                className="h-12"
                inputMode="numeric"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cost price</Label>
              <Input
                className="h-12"
                inputMode="decimal"
                value={form.cost_price}
                onChange={(e) => set("cost_price", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Selling price</Label>
              <Input
                className="h-12"
                inputMode="decimal"
                value={form.selling_price}
                onChange={(e) => set("selling_price", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button className="h-12 w-full text-base" disabled={saving || uploading} onClick={save}>
            {saving ? "Saving..." : product ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
