"use client";

import Image from "next/image";
import { useState } from "react";

function isProjectStorageImage(src: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return false;

  try {
    const imageUrl = new URL(src);
    const projectUrl = new URL(configuredUrl);
    return imageUrl.origin === projectUrl.origin &&
      (imageUrl.pathname.startsWith("/storage/v1/object/public/product-images/") ||
        imageUrl.pathname.startsWith("/storage/v1/render/image/public/product-images/"));
  } catch {
    return false;
  }
}

export function CatalogImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={`sb-product-image-placeholder${className ? ` ${className}` : ""}`} aria-label="Image unavailable" role="img" />;
  }
  return (
    <Image
      alt={alt}
      className={className}
      fill
      onError={() => setFailed(true)}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
      sizes={sizes}
      src={src}
      unoptimized={isProjectStorageImage(src)}
    />
  );
}
