import type { Metadata } from "next";
import AdminPage from "./dashboard-page";

export const metadata: Metadata = {
  title: "Store administration | Sachin Brands",
  description: "Manage Sachin Brands products, orders and store settings.",
};

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({ searchParams }: { searchParams: Parameters<typeof AdminPage>[0]["searchParams"] }) {
  return AdminPage({ searchParams, section: "overview" });
}
