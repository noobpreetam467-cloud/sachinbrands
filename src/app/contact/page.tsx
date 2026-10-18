import type { Metadata } from "next";
import { ContactPage } from "@/components/storefront/content-pages";

export const metadata: Metadata = { title: "Contact" };
export default function Page() { return <ContactPage />; }
