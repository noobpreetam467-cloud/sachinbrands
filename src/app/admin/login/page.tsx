import type { Metadata } from "next";
import AdminLoginForm from "./admin-login-form";

export const metadata: Metadata = {
  title: "Admin sign in | Sachin Brands",
  description: "Sign in to the Sachin Brands store administration.",
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
