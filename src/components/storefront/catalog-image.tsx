"use client";

import Image from "next/image";
import { useState } from "react";

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
      priority={priority}
      sizes={sizes}
      src={src}
    />
  );
}
