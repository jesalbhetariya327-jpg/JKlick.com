import { useEffect, useState } from "react";
import { Shirt } from "lucide-react";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
};

/** Product photo with a plain placeholder fallback — never shows a broken image to shoppers. */
export function ProductImage({ src, alt, className, loading = "lazy" }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className ?? ""}`}
        role="img"
        aria-label={alt}
      >
        <Shirt className="size-1/4 min-h-6 min-w-6 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      fetchPriority={loading === "eager" ? "high" : "low"}
      onError={() => setFailed(true)}
    />
  );

}
