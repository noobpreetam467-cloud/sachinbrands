import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { createReadOnlyClient } from "@/utils/supabase/server";

export type StorefrontContent = {
  public_store_name: string;
  support_email: string;
  support_phone: string;
  shipping_policy: string;
  return_policy: string;
  return_window_days: number;
  hero_headline: string;
  hero_description: string;
  hero_cta_label: string;
  hero_cta_url: string;
  hero_image_url: string | null;
  featured_category_ids: string[];
  featured_product_ids: string[];
  promotion_headline: string;
  promotion_body: string;
  promotion_cta_label: string;
  promotion_cta_url: string;
  promotion_image_url: string | null;
};

export const getStorefrontContent = cache(async (): Promise<StorefrontContent | null> => {
  try {
    const supabase = await createReadOnlyClient();
    const { data, error } = await supabase
      .from("storefront_content")
      .select("public_store_name,support_email,support_phone,shipping_policy,return_policy,return_window_days,hero_headline,hero_description,hero_cta_label,hero_cta_url,hero_image_url,featured_category_ids,featured_product_ids,promotion_headline,promotion_body,promotion_cta_label,promotion_cta_url,promotion_image_url")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      console.error("Could not load public store contact and policy content:", error.message);
      return null;
    }
    return data as StorefrontContent | null;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not configure public storefront content:", error);
    return null;
  }
});
