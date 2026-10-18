import type { Metadata } from "next";
import { PolicyPage } from "@/components/storefront/content-pages";

export const metadata: Metadata = { title: "Returns" };
export default function Page() { return <PolicyPage page="returns" />; }
