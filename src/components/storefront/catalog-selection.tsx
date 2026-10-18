"use client";

import { useEffect, useState } from "react";
import { CATALOG_PRODUCT_SELECT, mapCatalogProduct, type CatalogProductRow, type StoreProduct } from "@/data/catalog-types";
import { createClient } from "@/utils/supabase/client";

type ProductLookup = {
  products: StoreProduct[];
  loading: boolean;
  error: string | null;
};

export function useLiveProducts(ids: string[]): ProductLookup {
  const key = ids.join("|");
  const [result, setResult] = useState<ProductLookup>({
    products: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!key) {
        setResult({ products: [], loading: false, error: null });
        return;
      }
      void (async () => {
        try {
          const requestedIds = key.split("|");
          const supabase = createClient();
          const { data, error } = await supabase
            .from("catalog_products")
            .select(CATALOG_PRODUCT_SELECT)
            .in("id", requestedIds);
          if (error) throw error;
          const byId = new Map(
            ((data ?? []) as CatalogProductRow[]).map((row) => [row.id, mapCatalogProduct(row)]),
          );
          if (!cancelled) {
            setResult({
              products: requestedIds.flatMap((id) => {
                const product = byId.get(id);
                return product ? [product] : [];
              }),
              loading: false,
              error: null,
            });
          }
        } catch (error) {
          console.error("Could not load selected catalog products:", error);
          if (!cancelled) {
            setResult({
              products: [],
              loading: false,
              error: "Saved products could not be loaded from Supabase.",
            });
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [key]);

  return result;
}
