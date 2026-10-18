import type { Metadata } from "next";
import { PolicyPage } from "@/components/storefront/content-pages";

export const metadata: Metadata = { title: "Privacy" };
export default function Page() { return <PolicyPage page="privacy" />; }
