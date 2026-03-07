import { useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCardProps {
  src: string;
  alt?: string;
  className?: string;
  maxHeight?: string;
}

/** Transforms known cloud URLs to direct image links */
function resolveImageUrl(url: string): string {
  // Dropbox: change dl=0 to dl=1
  if (url.includes("dropbox.com") && !url.includes("dl=1")) {
    return url.replace("dl=0", "dl=1").replace(/\?$/, "") + (url.includes("?") ? "&dl=1" : "?dl=1");
  }
  // Google Drive: /file/d/ID/view -> /uc?export=view&id=ID
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  return url;
}

export const ImageCard = ({ src, alt = "Card image", className, maxHeight = "200px" }: ImageCardProps) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const resolvedSrc = resolveImageUrl(src);

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-md", className)}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">Imagem indisponível</span>
        </div>
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(
          "object-contain w-full transition-opacity duration-300",
          status === "loaded" ? "opacity-100" : "opacity-0"
        )}
        style={{ maxHeight }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
