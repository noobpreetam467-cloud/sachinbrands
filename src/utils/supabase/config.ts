function isPublicSupabaseKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  if (!key.startsWith("eyJ")) return false;

  try {
    const payload = key.split(".")[1];
    if (!payload) return false;
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims === "object" && claims !== null && "role" in claims && claims.role === "anon";
  } catch {
    return false;
  }
}

function readSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL.");
  }

  if (
    (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS and must not contain credentials.");
  }

  if (!isPublicSupabaseKey(publishableKey)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable or legacy anon key. Never use a secret or service-role key.",
    );
  }

  return { url: parsedUrl.origin, publishableKey };
}

export function getSupabaseConfig() {
  return readSupabaseConfig();
}

export function isSupabaseConfigured() {
  try {
    readSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}
