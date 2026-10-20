import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import AdminDashboard from "./admin-dashboard";
import { createClient } from "@/utils/supabase/server";
import { isRazorpayConfigured } from "@/utils/razorpay-config";

type SearchParams = Promise<{
  days?: string;
  ordersPage?: string;
  customersPage?: string;
  productsPage?: string;
  orderStatus?: string;
  orderSearch?: string;
  customerId?: string;
  notice?: string;
  error?: string;
}>;

export type AdminSection = "overview" | "products" | "categories" | "orders" | "customers" | "inventory" | "coupons" | "returns" | "reviews" | "settings";

function pageNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10000) : 1;
}

export default async function AdminPage({ searchParams, section }: { searchParams: SearchParams; section: AdminSection }) {
  const params = await searchParams;
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not configure the admin dashboard Supabase client:", error);
    return (
      <main className="sb-admin-access">
        <h1>Supabase configuration required</h1>
        <p>Set this deployment&apos;s Supabase project URL and publishable key before using administrator tools.</p>
        <Link className="sb-button sb-button-outline" href="/">Back to store</Link>
      </main>
    );
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not load the current administrator session:", authError.message);
  }

  if (!user) {
    return (
      <main className="sb-admin-access">
        <h1>Administrator sign-in required</h1>
        <p>Sign in to an account that has been provisioned by the Supabase project owner.</p>
        <Link className="sb-button sb-button-primary" href="/admin/login">Admin sign in</Link>
      </main>
    );
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_store_admin");
  if (roleError) {
    console.error("Could not verify the administrator role. Apply the admin migration first:", roleError.message);
    return (
      <main className="sb-admin-access">
        <h1>Admin setup is incomplete</h1>
        <p>The database could not verify your administrator role. Apply the catalog, checkout, customer-account, and admin-dashboard migrations in order, then provision an administrator from the Supabase SQL Editor.</p>
        <Link className="sb-button sb-button-outline" href="/">Back to store</Link>
      </main>
    );
  }
  if (isAdmin !== true) {
    return (
      <main className="sb-admin-access">
        <h1>Administrator access required</h1>
        <p>This account is not provisioned for store administration. A project owner must add its Supabase Auth user ID to <code>public.admin_users</code>.</p>
        <Link className="sb-button sb-button-outline" href="/">Back to store</Link>
      </main>
    );
  }

  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 7;
  const ordersPage = pageNumber(params.ordersPage);
  const customersPage = pageNumber(params.customersPage);
  const productsPage = pageNumber(params.productsPage);
  const validStatus = ["pending_payment", "confirmed", "processing", "shipped", "delivered", "cancelled"].includes(params.orderStatus ?? "")
    ? params.orderStatus!
    : null;
  const productFrom = (productsPage - 1) * 25;

  type AdminRow = Record<string, unknown>;
  const emptyRows: AdminRow[] = [];
  const errors: { message: string }[] = [];
  let metrics: AdminRow = {};
  let orders: AdminRow[] = emptyRows;
  let orderTotal = 0;
  let customers: AdminRow[] = emptyRows;
  let customerTotal = 0;
  let customerOrders: AdminRow[] = emptyRows;
  let categories: AdminRow[] = emptyRows;
  let products: AdminRow[] = emptyRows;
  let productTotal = 0;
  let coupons: AdminRow[] = emptyRows;
  let settings: AdminRow = {};
  let storefront: AdminRow = {};
  let inventory: AdminRow[] = emptyRows;
  let returns: AdminRow[] = emptyRows;
  let reviews: AdminRow[] = emptyRows;

  if (section === "overview") {
    const result = await supabase.rpc("admin_dashboard_metrics", { p_days: days });
    if (result.error) errors.push(result.error);
    metrics = (result.data ?? {}) as AdminRow;
  }

  if (section === "orders") {
    const result = await supabase.rpc("admin_order_list", {
      p_limit: 20,
      p_offset: (ordersPage - 1) * 20,
      p_status: validStatus,
      p_search: params.orderSearch?.trim() || null,
    });
    if (result.error) errors.push(result.error);
    orders = (result.data?.orders ?? []) as AdminRow[];
    orderTotal = Number(result.data?.total ?? 0);
  }

  if (section === "customers") {
    const [customerResult, historyResult] = await Promise.all([
      supabase.rpc("admin_customer_list", { p_limit: 50, p_offset: (customersPage - 1) * 50 }),
      params.customerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.customerId)
        ? supabase.rpc("admin_customer_orders", { p_user_id: params.customerId })
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (customerResult.error) errors.push(customerResult.error);
    if (historyResult.error) errors.push(historyResult.error);
    customers = (customerResult.data?.customers ?? []) as AdminRow[];
    customerTotal = Number(customerResult.data?.total ?? 0);
    customerOrders = (historyResult.data ?? []) as AdminRow[];
  }

  if (section === "categories") {
    const result = await supabase.from("categories").select("*").order("display_order").order("name");
    if (result.error) errors.push(result.error);
    categories = (result.data ?? []) as AdminRow[];
  }

  if (section === "products") {
    const [categoriesResult, productsResult] = await Promise.all([
      supabase.from("categories").select("*").order("display_order").order("name"),
      supabase.from("products")
        .select("id,category_id,slug,name,brand,description,specifications,price_inr,original_price_inr,status,created_at,categories(name),product_images(image_url,position),product_variants(id,sku,name,attributes,price_inr,original_price_inr,stock_quantity,is_active)", { count: "exact" })
        .order("created_at", { ascending: false }).range(productFrom, productFrom + 24),
    ]);
    if (categoriesResult.error) errors.push(categoriesResult.error);
    if (productsResult.error) errors.push(productsResult.error);
    categories = (categoriesResult.data ?? []) as AdminRow[];
    products = (productsResult.data ?? []) as unknown as AdminRow[];
    productTotal = productsResult.count ?? 0;
  }

  if (section === "inventory") {
    const [productsResult, movementsResult] = await Promise.all([
      supabase.from("products")
        .select("id,name,product_variants(id,sku,name,stock_quantity,is_active)")
        .order("name")
        .range(productFrom, productFrom + 24),
      supabase.from("inventory_movements")
        .select("id,variant_id,quantity_change,reason,note,actor_user_id,created_at,product_variants(name,sku,products(name))")
        .order("created_at", { ascending: false }).limit(20),
    ]);
    if (productsResult.error) errors.push(productsResult.error);
    if (movementsResult.error) errors.push(movementsResult.error);
    products = (productsResult.data ?? []) as unknown as AdminRow[];
    inventory = (movementsResult.data ?? []) as unknown as AdminRow[];
  }

  if (section === "settings") {
    const [categoriesResult, productsResult, settingsResult, storefrontResult] = await Promise.all([
      supabase.from("categories").select("*").order("display_order").order("name"),
      supabase.from("products").select("id").eq("status", "published").order("name").limit(2),
      supabase.from("store_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("storefront_content").select("*").eq("id", true).maybeSingle(),
    ]);
    if (categoriesResult.error) errors.push(categoriesResult.error);
    if (productsResult.error) errors.push(productsResult.error);
    if (settingsResult.error) errors.push(settingsResult.error);
    if (storefrontResult.error) errors.push(storefrontResult.error);
    categories = (categoriesResult.data ?? []) as AdminRow[];
    products = (productsResult.data ?? []) as unknown as AdminRow[];
    settings = (settingsResult.data ?? {}) as AdminRow;
    storefront = (storefrontResult.data ?? {}) as AdminRow;
  }

  if (section === "coupons") {
    const result = await supabase.from("coupons")
      .select("id,code,discount_type,discount_value,minimum_subtotal_inr,maximum_discount_inr,usage_limit,per_user_limit,starts_at,expires_at,is_active")
      .order("created_at", { ascending: false }).limit(100);
    if (result.error) errors.push(result.error);
    coupons = (result.data ?? []) as AdminRow[];
  }

  if (section === "returns") {
    const result = await supabase.from("return_requests").select("id,user_id,order_id,reason,status,created_at").order("created_at", { ascending: false }).limit(50);
    if (result.error) errors.push(result.error);
    returns = (result.data ?? []) as AdminRow[];
  }

  if (section === "reviews") {
    const result = await supabase.from("reviews").select("id,product_id,user_id,rating,title,body,status,created_at").order("created_at", { ascending: false }).limit(50);
    if (result.error) errors.push(result.error);
    reviews = (result.data ?? []) as AdminRow[];
  }

  if (errors.length) {
    for (const error of errors) console.error("Admin dashboard query failed:", error.message);
  }

  return (
    <AdminDashboard
      activeSection={section}
      categories={categories}
      coupons={coupons}
      customers={customers}
      customerOrders={customerOrders}
      customerPage={customersPage}
      customerTotal={customerTotal}
      customerId={params.customerId ?? ""}
      days={days}
      errorMessage={errors.length ? "Some dashboard data could not be loaded. Check the database migration state and server logs before making changes." : null}
      errorCode={params.error ?? null}
      inventory={inventory}
      metrics={metrics}
      notice={params.notice ?? null}
      orderPage={ordersPage}
      orderSearch={params.orderSearch ?? ""}
      orderStatus={validStatus ?? ""}
      orders={orders}
      orderTotal={orderTotal}
      productPage={productsPage}
      productTotal={productTotal}
      products={products}
      returns={returns}
      razorpayConfigured={isRazorpayConfigured()}
      reviews={reviews}
      settings={settings}
      storefront={storefront}
      userEmail={user.email ?? ""}
    />
  );
}
