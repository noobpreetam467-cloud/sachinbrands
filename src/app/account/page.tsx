import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SITE_LOGO_PATH, SITE_NAME } from "@/config/site";
import { formatPrice } from "@/data/catalog-types";
import { isSupabaseConfigured } from "@/utils/supabase/config";
import { createReadOnlyClient } from "@/utils/supabase/server";
import {
  logout,
  markNotificationRead,
  saveProfileAddress,
  saveNotificationPreferences,
  sendPasswordReset,
  updateProfile,
} from "./actions";

type Section = "profile" | "edit-profile" | "orders" | "addresses" | "wishlist" | "notifications" | "security" | "returns";
const sections: { id: Section; label: string; icon: string }[] = [
  { id: "profile", label: "Overview", icon: "user" },
  { id: "edit-profile", label: "Personal information", icon: "edit" },
  { id: "orders", label: "My orders", icon: "box" },
  { id: "addresses", label: "Saved addresses", icon: "pin" },
  { id: "wishlist", label: "Wishlist", icon: "heart" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "returns", label: "Returns", icon: "return" },
  { id: "security", label: "Password & security", icon: "shield" },
];

export const metadata: Metadata = {
  title: "My account",
  description: "Manage your Sachin Brands profile, orders, addresses and preferences.",
};

export const dynamic = "force-dynamic";

function ProfileIcon({ name }: { name: string }) {
  const shapes: Record<string, ReactNode> = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    edit: <><path d="M12 20h9" /><path d="m16.5 3.5 4 4L9 19l-5 1 1-5Z" /></>,
    box: <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3.5 8.2 8.5 4.7 8.5-4.7M12 13v8" /></>,
    return: <><path d="M3 4v6h6" /><path d="M4.5 15a8 8 0 1 0 1-9L3 10" /></>,
    heart: <path d="M20.8 8.7c0 4.2-8.8 10-8.8 10s-8.8-5.8-8.8-10a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
  };
  return <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{shapes[name] ?? shapes.user}</svg>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="account-empty-state"><span aria-hidden="true"><ProfileIcon name="box" /></span><h3>{title}</h3><p>{message}</p></div>;
}

type SavedAddress = {
  id: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pin_code: string;
  is_default: boolean;
};

function AddressForm({ address }: { address?: SavedAddress }) {
  return (
    <form action={saveProfileAddress} className="profile-address-form">
      <input name="addressId" type="hidden" value={address?.id ?? ""} />
      <label>Recipient name<input autoComplete="name" defaultValue={address?.recipient_name ?? ""} maxLength={100} minLength={2} name="recipientName" required /></label>
      <label>Indian mobile number<input autoComplete="tel-national" defaultValue={address?.phone ?? ""} inputMode="numeric" maxLength={10} name="phone" pattern="[6-9][0-9]{9}" required /></label>
      <label className="is-wide">Address line 1<input autoComplete="address-line1" defaultValue={address?.line1 ?? ""} maxLength={200} minLength={3} name="line1" required /></label>
      <label className="is-wide">Address line 2 (optional)<input autoComplete="address-line2" defaultValue={address?.line2 ?? ""} maxLength={200} name="line2" /></label>
      <label>City<input autoComplete="address-level2" defaultValue={address?.city ?? ""} maxLength={100} minLength={2} name="city" required /></label>
      <label>State<input autoComplete="address-level1" defaultValue={address?.state ?? ""} maxLength={100} minLength={2} name="state" required /></label>
      <label>PIN code<input autoComplete="postal-code" defaultValue={address?.pin_code ?? ""} inputMode="numeric" maxLength={6} minLength={6} name="pinCode" pattern="[1-9][0-9]{5}" required /></label>
      <label className="profile-address-default"><input defaultChecked={address?.is_default ?? false} name="isDefault" type="checkbox" /> Set as default address</label>
      <button className="profile-secondary-button" type="submit">{address ? "Save address" : "Add address"}</button>
    </form>
  );
}

function readableStatus(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; error?: string; updated?: string }>;
}) {
  let supabase: Awaited<ReturnType<typeof createReadOnlyClient>>;
  try {
    supabase = await createReadOnlyClient();
  } catch (error) {
    console.error("Could not configure the customer account:", error);
    const message = isSupabaseConfigured()
      ? "The Supabase account service could not be initialized. Check the deployment configuration and try again."
      : "Supabase is not configured for this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.";
    return <main className="account-page account-dashboard-page"><section className="profile-panel"><h1>Account setup required</h1><p>{message}</p></section></main>;
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not verify the customer account session:", authError.message);
  }
  if (!user?.email) redirect("/login?callbackUrl=%2Faccount");

  const params = await searchParams;
  const selected = sections.some((item) => item.id === params.section) ? params.section as Section : "profile";
  const title = sections.find((item) => item.id === selected)?.label ?? "Overview";
  const [profileResult, ordersResult, addressesResult, wishlistResult, preferencesResult, notificationsResult, returnsResult, storefrontResult] = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("user_id", user.id).maybeSingle(),
    supabase.from("orders").select("id,order_number,status,payment_status,payment_method,total_inr,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(10),
    supabase.from("addresses").select("id,recipient_name,phone,line1,line2,city,state,pin_code,is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("wishlist_items").select("id,product_id,products(name,slug,price_inr)").order("created_at", { ascending: false }),
    supabase.from("notification_preferences").select("order_updates,security_alerts,promotions").eq("user_id", user.id).maybeSingle(),
    supabase.from("notifications").select("id,title,body,event_type,order_id,created_at,read_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("return_requests").select("id,order_id,reason,status,created_at").order("created_at", { ascending: false }),
    supabase.from("storefront_content").select("return_window_days").eq("id", true).maybeSingle(),
  ]);
  const results = [profileResult, ordersResult, addressesResult, wishlistResult, preferencesResult, notificationsResult, returnsResult, storefrontResult];
  const dataError = results.find((result) => result.error)?.error;
  if (dataError) console.error("Could not load all customer account data:", dataError.message);
  const profile = profileResult.data;
  const fullName = profile?.full_name || (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : user.email.split("@")[0]);
  const orders = ordersResult.data ?? [];
  const addresses = addressesResult.data ?? [];
  const wishlist = wishlistResult.data ?? [];
  const preferences = preferencesResult.data ?? { order_updates: true, security_alerts: true, promotions: false };
  const notifications = notificationsResult.data ?? [];
  const returns = returnsResult.data ?? [];
  const returnWindowDays = storefrontResult.data?.return_window_days ?? 30;
  const stats = [
    { label: "Orders", value: ordersResult.count ?? orders.length, icon: "box", section: "orders" as const },
    { label: "Saved addresses", value: addresses.length, icon: "pin", section: "addresses" as const },
    { label: "Wishlist", value: wishlist.length, icon: "heart", section: "wishlist" as const },
    { label: "Unread updates", value: notifications.filter((item) => !item.read_at).length, icon: "bell", section: "notifications" as const },
  ];

  return (
    <main className="account-page account-dashboard-page">
      <header className="account-header">
        <Link aria-label={`${SITE_NAME} home`} className="auth-brand" href="/"><Image alt="" height={34} priority src={SITE_LOGO_PATH} width={34} /><span>{SITE_NAME}</span></Link>
        <Link className="auth-header-link" href="/">Back to store <span aria-hidden="true">↗</span></Link>
      </header>
      <div className="account-dashboard">
        <aside aria-label="Profile menu" className="profile-sidebar">
          <nav className="profile-menu">
            {sections.map((item) => <Link aria-current={selected === item.id ? "page" : undefined} className={`profile-menu-link${selected === item.id ? " is-active" : ""}`} href={`/account?section=${item.id}`} key={item.id}><ProfileIcon name={item.icon} /><span>{item.label}</span></Link>)}
          </nav>
          <form action={logout} className="profile-logout"><button type="submit"><ProfileIcon name="return" /><span>Logout</span></button></form>
        </aside>

        <section aria-labelledby="profile-page-title" className="profile-content">
          <div className="profile-content-heading"><p className="account-section-label">YOUR ACCOUNT</p><h1 id="profile-page-title">{title}</h1></div>
          {dataError && <p className="profile-form-message is-error" role="alert">Some account information could not be loaded. Refresh the page or try again later.</p>}

          {selected === "profile" && <>
            <section aria-label="Profile overview" className="profile-summary-card"><div><div className="profile-summary-name"><h2>{fullName}</h2>{user.email_confirmed_at && <span className="profile-verified"><ProfileIcon name="check" />Verified email</span>}</div><p className="profile-email">{user.email}</p><p className="profile-member-meta">Member since {new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p><Link className="profile-membership-link" href="/account?section=edit-profile">Edit personal information</Link></div></section>
            <div aria-label="Account summary" className="profile-stat-grid">{stats.map((item) => <Link className="profile-stat-card" href={`/account?section=${item.section}`} key={item.label}><span className="profile-stat-icon"><ProfileIcon name={item.icon} /></span><span className="profile-stat-copy"><span>{item.label}</span><strong>{item.value}</strong></span></Link>)}</div>
            <p className="profile-data-note">Your account data is loaded from Supabase and protected by customer-level row security.</p>
          </>}

          {selected === "edit-profile" && <section className="profile-panel"><h2>Personal information</h2>
            {params.error === "invalid-name" && <p className="profile-form-message is-error" role="alert">Enter a name between 2 and 100 characters.</p>}
            {params.error === "invalid-phone" && <p className="profile-form-message is-error" role="alert">Enter a valid 10-digit Indian mobile number.</p>}
            {params.error === "update-failed" && <p className="profile-form-message is-error" role="alert">We couldn&apos;t save your profile. Please try again.</p>}
            <form action={updateProfile} className="profile-edit-form">
              <label htmlFor="profile-name">Full name</label><input autoComplete="name" defaultValue={fullName} id="profile-name" maxLength={100} minLength={2} name="name" required />
              <label htmlFor="profile-email">Email address</label><input autoComplete="email" defaultValue={user.email} id="profile-email" readOnly type="email" />
              <p>Email changes are managed by Supabase account security.</p>
              <label htmlFor="profile-phone">Mobile number</label><input autoComplete="tel-national" defaultValue={profile?.phone ?? ""} id="profile-phone" inputMode="numeric" maxLength={10} name="phone" pattern="[6-9][0-9]{9}" />
              <button type="submit">Save changes</button>
            </form>
          </section>}

          {selected === "orders" && <section className="profile-panel"><h2>Recent orders</h2>{orders.length ? <div className="account-orders">{orders.map((order) => <article className="account-order" key={order.id}><div className="account-order-heading"><div><Link href={`/orders/${encodeURIComponent(order.order_number)}`}><strong>{order.order_number}</strong></Link><span>{new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span></div><span className={`account-order-status account-status-${order.status}`}>{readableStatus(order.status)}</span></div><div className="account-order-bottom"><span>{readableStatus(order.payment_status)} · {order.payment_method === "cod" ? "Cash on Delivery" : "Razorpay"}</span><strong>{formatPrice(Number(order.total_inr))}</strong></div><Link className="account-order-detail-link" href={`/orders/${encodeURIComponent(order.order_number)}`}>View order tracking</Link></article>)}</div> : <EmptyState title="No orders yet" message="Your orders will appear here after your first purchase." />}</section>}

          {selected === "addresses" && <section className="profile-panel"><h2>Saved addresses</h2>{params.error === "address" && <p className="profile-form-message is-error" role="alert">Check the address details and try again.</p>}{params.updated === "address" && <p className="profile-form-message" role="status">The address was saved.</p>}{addresses.length ? <div className="profile-address-list">{(addresses as SavedAddress[]).map((address) => <article className="profile-address-card" key={address.id}><strong>{address.recipient_name}{address.is_default && <span className="profile-default-badge">Default</span>}</strong><span>{address.phone}</span><span>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</span><span>{address.city}, {address.state} {address.pin_code}</span><details className="profile-address-edit"><summary>Edit address</summary><AddressForm address={address} /></details></article>)}</div> : <EmptyState title="No saved addresses" message="Add an address and it will be saved securely to your account." />}<details className="profile-address-add"><summary>Add a new address</summary><AddressForm /></details></section>}

          {selected === "wishlist" && <section className="profile-panel"><h2>Saved products</h2>{wishlist.length ? <div className="profile-wishlist-list">{wishlist.map((item) => { const product = Array.isArray(item.products) ? item.products[0] : item.products; return product ? <article className="profile-wishlist-item" key={item.id}><Link href={`/products/${product.slug}`}>{product.name}</Link><strong>{formatPrice(Number(product.price_inr))}</strong></article> : null; })}</div> : <EmptyState title="Your wishlist is empty" message="Tap the heart on a product to save it for later." />}</section>}

          {selected === "notifications" && <section className="profile-panel"><h2>Notification preferences</h2>{params.error && <p className="profile-form-message is-error" role="alert">We couldn&apos;t update this notification setting. Try again.</p>}{params.updated === "preferences" && <p className="profile-form-message" role="status">Your preferences have been saved.</p>}
            <form action={saveNotificationPreferences} className="profile-preferences-form">
              <label><input defaultChecked={preferences.order_updates} name="orderUpdates" type="checkbox" /> Order confirmation and shipping updates</label>
              <label><input defaultChecked={preferences.security_alerts} name="securityAlerts" type="checkbox" /> Important account security alerts</label>
              <label><input defaultChecked={preferences.promotions} name="promotions" type="checkbox" /> Product news and promotional messages</label>
              <button className="profile-secondary-button" type="submit">Save preferences</button>
            </form>
            <h3 className="profile-subheading">In-app updates</h3>
            {notifications.length ? <div className="profile-notification-list">{notifications.map((item) => <article className={`profile-notification${item.read_at ? "" : " is-unread"}`} key={item.id}><div><strong>{item.title}</strong><p>{item.body}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>{item.order_id && (() => { const orderNumber = orders.find((order) => order.id === item.order_id)?.order_number; return orderNumber ? <Link href={`/orders/${encodeURIComponent(orderNumber)}`}>View order</Link> : null; })()}</div>{!item.read_at && <form action={markNotificationRead}><input name="id" type="hidden" value={item.id} /><button type="submit">Mark read</button></form>}</article>)}</div> : <EmptyState title="No updates yet" message="Order confirmations and shipping updates will appear here when they happen." />}
          </section>}

          {selected === "returns" && <section className="profile-panel"><h2>Returns and refunds</h2><p className="profile-section-description">Return requests can be made within {returnWindowDays} days of delivery. Refunds are not issued by this request form and require verified store/payment processing.</p>{returns.length ? <div className="profile-notification-list">{returns.map((item) => <article className="profile-notification" key={item.id}><div><strong>{orders.find((order) => order.id === item.order_id)?.order_number ?? "Return request"}</strong><p>{item.reason}</p><span className="account-order-status">{readableStatus(item.status)}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</time></div></article>)}</div> : <EmptyState title="No return requests" message="Eligible orders can request a return from their order tracking page." />}</section>}

          {selected === "security" && <section className="profile-panel"><h2>Password and security</h2><p className="profile-section-description">Reset your password using the verified email associated with your Supabase account. The reset link expires according to your Supabase Auth settings.</p>{params.error === "password-reset" && <p className="profile-form-message is-error" role="alert">We couldn&apos;t send a password reset email. Check your Supabase email configuration.</p>}{params.updated === "password-reset" && <p className="profile-form-message" role="status">If the account email is eligible, Supabase will send a password reset link.</p>}<form action={sendPasswordReset}><button className="profile-secondary-button" type="submit">Send password reset email</button></form></section>}

          {params.updated === "profile" && selected === "profile" && <p className="profile-form-message" role="status">Your profile was updated.</p>}
          <footer className="account-footer">© {new Date().getFullYear()} {SITE_NAME} <span>·</span> Thoughtfully selected tech.</footer>
        </section>
      </div>
    </main>
  );
}
