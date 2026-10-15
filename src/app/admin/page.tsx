import type { Metadata } from "next";
import AdminDashboard from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Admin dashboard",
  description: "Store overview and operations dashboard.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
