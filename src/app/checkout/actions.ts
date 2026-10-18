"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const addressSchema = z.object({
  id: z.string().uuid().nullable(),
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().trim()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/)),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pinCode: z.string().trim().regex(/^[1-9]\d{5}$/),
  isDefault: z.boolean(),
});

const cartItemsSchema = z.array(z.object({
  variant_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
})).min(1).max(40);

export type AddressInput = z.input<typeof addressSchema>;

export type CheckoutTotals = {
  subtotal_inr: number;
  discount_inr: number;
  shipping_inr: number;
  tax_inr: number;
  total_inr: number;
  coupon_id: string | null;
  coupon_code: string | null;
  tax_rate_percent: number;
};

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    if (/Authentication required/i.test(error.message)) return "Please sign in to continue checkout.";
    if (/Cart is empty|invalid cart/i.test(error.message)) return "Your cart is empty or invalid. Review it before continuing.";
    if (/exceeds available stock|no longer available/i.test(error.message)) return "An item in your cart is no longer available in the requested quantity. Update your cart and try again.";
    if (/coupon/i.test(error.message)) return error.message;
    if (/address/i.test(error.message)) return error.message;
    if (/Cash on Delivery|Online payment/i.test(error.message)) return error.message;
  }
  return fallback;
}

export async function saveAddress(input: AddressInput): Promise<ActionResult<string>> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: "Please check the address details and try again." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { data: null, error: "Please sign in to manage shipping addresses." };

  const address = parsed.data;
  const { data, error } = await supabase.rpc("save_customer_address", {
    p_address_id: address.id,
    p_recipient_name: address.recipientName,
    p_phone: address.phone,
    p_line1: address.line1,
    p_line2: address.line2,
    p_city: address.city,
    p_state: address.state,
    p_pin_code: address.pinCode,
    p_is_default: address.isDefault,
  });
  if (error) {
    console.error("Could not save customer address:", error.message);
    return { data: null, error: getErrorMessage(error, "We couldn't save this address. Please try again.") };
  }

  revalidatePath("/checkout");
  return { data: data as string, error: null };
}

export async function previewCheckout(
  items: unknown,
  couponCode: string,
): Promise<ActionResult<CheckoutTotals>> {
  const parsedItems = cartItemsSchema.safeParse(items);
  if (!parsedItems.success) return { data: null, error: "Your cart is empty or invalid." };
  const coupon = z.string().trim().max(40).safeParse(couponCode);
  if (!coupon.success) return { data: null, error: "Coupon code is too long." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { data: null, error: "Please sign in to continue checkout." };

  const { data, error } = await supabase.rpc("preview_checkout", {
    p_items: parsedItems.data,
    p_coupon_code: coupon.data || null,
  });
  if (error || !data || typeof data !== "object") {
    if (error) console.error("Could not calculate checkout preview:", error.message);
    return { data: null, error: getErrorMessage(error, "We couldn't calculate your order total. Please try again.") };
  }

  const result = data as Record<string, unknown>;
  return {
    data: {
      subtotal_inr: Number(result.subtotal_inr),
      discount_inr: Number(result.discount_inr),
      shipping_inr: Number(result.shipping_inr),
      tax_inr: Number(result.tax_inr),
      total_inr: Number(result.total_inr),
      coupon_id: typeof result.coupon_id === "string" ? result.coupon_id : null,
      coupon_code: typeof result.coupon_code === "string" ? result.coupon_code : null,
      tax_rate_percent: Number(result.tax_rate_percent),
    },
    error: null,
  };
}
