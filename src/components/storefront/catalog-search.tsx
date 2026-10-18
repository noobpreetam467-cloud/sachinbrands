"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { normalizeCatalogSearchTerm } from "@/data/catalog-types";
import { Icon } from "./icon";

type Suggestion = {
  label: string;
  href: string;
  detail: string;
};

export function CatalogSearch() {
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const safeTerm = normalizeCatalogSearchTerm(query);
          if (!safeTerm) {
            if (!cancelled) {
              setSuggestions([]);
              setError(false);
            }
            return;
          }
          const supabase = createClient();
          const [productResult, categoryResult] = await Promise.all([
            supabase
              .from("catalog_products")
              .select("name,brand,slug")
              .or(`name.ilike.%${safeTerm}%,brand.ilike.%${safeTerm}%`)
              .limit(5),
            supabase
              .from("categories")
              .select("name,slug")
              .eq("is_active", true)
              .ilike("name", `%${safeTerm}%`)
              .limit(3),
          ]);

          if (productResult.error || categoryResult.error) {
            console.error(
              "Supabase search suggestions failed:",
              productResult.error ?? categoryResult.error,
            );
            if (!cancelled) {
              setSuggestions([]);
              setError(true);
            }
            return;
          }

          if (!cancelled) {
            setSuggestions([
              ...(productResult.data ?? []).map((product) => ({
                label: product.name,
                href: `/products/${product.slug}`,
                detail: product.brand,
              })),
              ...(categoryResult.data ?? []).map((category) => ({
                label: category.name,
                href: `/categories/${category.slug}`,
                detail: "Category",
              })),
            ]);
            setError(false);
          }
        } catch (cause) {
          console.error("Could not load catalog search suggestions:", cause);
          if (!cancelled) {
            setSuggestions([]);
            setError(true);
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [term]);

  return (
    <div className="sb-search-wrap">
      <form action="/search" className="sb-search" role="search">
        <Icon name="search" size={19} />
        <input
          aria-autocomplete="list"
          aria-label="Search products"
          autoComplete="off"
          name="q"
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search products, brands and more"
          value={term}
        />
        <kbd>⌘ K</kbd>
      </form>
      {term.trim().length >= 2 && (suggestions.length > 0 || error) && (
        <div className="sb-search-suggestions" role="listbox">
          {error ? (
            <p>Live search suggestions are unavailable.</p>
          ) : suggestions.map((item) => (
            <Link href={item.href} key={`${item.href}:${item.label}`} role="option">
              <span>{item.label}</span><small>{item.detail}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
