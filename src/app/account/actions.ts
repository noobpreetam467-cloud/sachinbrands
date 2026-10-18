"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?callbackUrl=%2Faccount");
  return { supabase, user };
}

export async function updateProfile(formData: FormData) {
  const name = formData.get("name");
  const rawPhone = formData.get("phone");
  const phone = typeof rawPhone === "string" ? rawPhone.replace(/[\s()-]/g, "") : "";
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    redirect("/account?section=edit-profile&error=invalid-name");
  }
  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    redirect("/account?section=edit-profile&error=invalid-phone");
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name.trim(), phone })
    .eq("user_id", user.id);
  if (error) {
    console.error("Supabase profile update failed:", error.message);
    redirect("/account?section=edit-profile&error=update-failed");
  }
  revalidatePath("/account");
  redirect("/account?section=profile&updated=profile");
}

export async function saveNotificationPreferences(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({
      user_id: user.id,
      order_updates: formData.get("orderUpdates") === "on",
      security_alerts: formData.get("securityAlerts") === "on",
      promotions: formData.get("promotions") === "on",
    }, { onConflict: "user_id" });
  if (error) {
    console.error("Could not update notification preferences:", error.message);
    redirect("/account?section=notifications&error=preferences");
  }
  revalidatePath("/account");
  redirect("/account?section=notifications&updated=preferences");
}

export async function saveProfileAddress(formData: FormData) {
  const addressIdValue = formData.get("addressId");
  const recipientName = formData.get("recipientName");
  const rawPhone = formData.get("phone");
  const line1 = formData.get("line1");
  const line2 = formData.get("line2");
  const city = formData.get("city");
  const state = formData.get("state");
  const pinCode = formData.get("pinCode");
  const isDefault = formData.get("isDefault") === "on";
  const phone = typeof rawPhone === "string" ? rawPhone.replace(/[\s()-]/g, "") : "";
  const addressId = typeof addressIdValue === "string" && addressIdValue ? addressIdValue : null;

  if (
    (addressId && !/^[0-9a-f-]{36}$/i.test(addressId)) ||
    typeof recipientName !== "string" || recipientName.trim().length < 2 || recipientName.trim().length > 100 ||
    !/^[6-9]\d{9}$/.test(phone) ||
    typeof line1 !== "string" || line1.trim().length < 3 || line1.trim().length > 200 ||
    typeof line2 !== "string" || line2.length > 200 ||
    typeof city !== "string" || city.trim().length < 2 || city.trim().length > 100 ||
    typeof state !== "string" || state.trim().length < 2 || state.trim().length > 100 ||
    typeof pinCode !== "string" || !/^[1-9]\d{5}$/.test(pinCode.trim())
  ) {
    redirect("/account?section=addresses&error=address");
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("save_customer_address", {
    p_address_id: addressId,
    p_recipient_name: recipientName.trim(),
    p_phone: phone,
    p_line1: line1.trim(),
    p_line2: line2.trim(),
    p_city: city.trim(),
    p_state: state.trim(),
    p_pin_code: pinCode.trim(),
    p_is_default: isDefault,
  });
  if (error) {
    console.error("Could not save profile address:", error.message);
    redirect("/account?section=addresses&error=address");
  }
  revalidatePath("/account");
  revalidatePath("/checkout");
  redirect("/account?section=addresses&updated=address");
}

export async function markNotificationRead(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/account?section=notifications&error=notification");
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_customer_notification_read", {
    p_notification_id: id,
  });
  if (error) {
    console.error("Could not mark notification as read:", error.message);
    redirect("/account?section=notifications&error=notification");
  }
  revalidatePath("/account");
  redirect("/account?section=notifications");
}

export async function cancelCodOrder(formData: FormData) {
  const orderId = formData.get("orderId");
  const orderNumber = formData.get("orderNumber");
  const orderPath = typeof orderNumber === "string" && /^SB-[A-Z0-9-]{5,40}$/i.test(orderNumber)
    ? `/orders/${encodeURIComponent(orderNumber)}`
    : "/orders";
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    redirect("/orders");
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cancel_customer_cod_order", { p_order_id: orderId });
  if (error) {
    console.error("Customer order cancellation was rejected:", error.message);
    redirect(`${orderPath}?error=cancel`);
  }
  revalidatePath("/orders");
  revalidatePath(orderPath);
  redirect(`${orderPath}?updated=cancelled`);
}

export async function requestReturn(formData: FormData) {
  const orderId = formData.get("orderId");
  const orderNumber = formData.get("orderNumber");
  const reason = formData.get("reason");
  const orderPath = typeof orderNumber === "string" && /^SB-[A-Z0-9-]{5,40}$/i.test(orderNumber)
    ? `/orders/${encodeURIComponent(orderNumber)}`
    : "/orders";
  if (
    typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) ||
    typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 1000
  ) {
    redirect(`${orderPath}?error=return`);
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("request_customer_return", {
    p_order_id: orderId,
    p_reason: reason.trim(),
  });
  if (error) {
    console.error("Customer return request was rejected:", error.message);
    redirect(`${orderPath}?error=return`);
  }
  revalidatePath("/account");
  revalidatePath("/orders");
  redirect(`${orderPath}?updated=return`);
}

export async function submitProductReview(formData: FormData) {
  const productId = formData.get("productId");
  const orderNumber = formData.get("orderNumber");
  const orderPath = typeof orderNumber === "string" && /^SB-[A-Z0-9-]{5,40}$/i.test(orderNumber)
    ? `/orders/${encodeURIComponent(orderNumber)}`
    : "/orders";
  const rating = Number(formData.get("rating"));
  const title = formData.get("title");
  const body = formData.get("body");
  if (
    typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId) ||
    !Number.isInteger(rating) || rating < 1 || rating > 5 ||
    (typeof title === "string" && title.trim().length > 120) ||
    (typeof body === "string" && body.trim().length > 2000)
  ) {
    redirect(`${orderPath}?error=review`);
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("reviews").insert({
    product_id: productId,
    user_id: user.id,
    rating,
    title: typeof title === "string" && title.trim() ? title.trim() : null,
    body: typeof body === "string" && body.trim() ? body.trim() : null,
    status: "pending",
  });
  if (error) {
    console.error("Customer product review was rejected:", error.message);
    redirect(`${orderPath}?error=review`);
  }
  revalidatePath("/orders");
  revalidatePath("/products");
  redirect(`${orderPath}?updated=review`);
}

export async function sendPasswordReset() {
  const { supabase, user } = await requireUser();
  if (!user.email) redirect("/account?section=security&error=password-reset");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("Could not determine the application host for password reset.");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${protocol}://${host}/auth/callback?next=%2Fauth%2Freset-password`,
  });
  if (error) {
    console.error("Supabase password reset request failed:", error.message);
    redirect("/account?section=security&error=password-reset");
  }
  redirect("/account?section=security&updated=password-reset");
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    redirect("/auth/reset-password?error=password");
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Supabase password update failed:", error.message);
    redirect("/auth/reset-password?error=update");
  }
  redirect("/account?section=security&updated=password");
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase sign-out failed:", error.message);
    throw new Error("We couldn't sign you out. Please try again.");
  }
  redirect("/");
}
