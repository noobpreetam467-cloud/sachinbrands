const INTERNAL_ORIGIN = "https://sachin-brands.invalid";

export function safeInternalPath(value: string | null | undefined, fallback = "/account") {
  if (!value || value.length > 500 || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
