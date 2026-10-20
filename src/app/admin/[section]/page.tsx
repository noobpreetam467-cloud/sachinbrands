import { notFound } from "next/navigation";
import AdminPage, { type AdminSection } from "../dashboard-page";

const sections: AdminSection[] = [
  "products",
  "categories",
  "orders",
  "customers",
  "inventory",
  "coupons",
  "returns",
  "reviews",
  "settings",
];

function isAdminSection(section: string): section is AdminSection {
  return sections.some((validSection) => validSection === section);
}

export const dynamic = "force-dynamic";

export default async function AdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Parameters<typeof AdminPage>[0]["searchParams"];
}) {
  const { section } = await params;
  if (!isAdminSection(section)) notFound();

  return AdminPage({ searchParams, section });
}
