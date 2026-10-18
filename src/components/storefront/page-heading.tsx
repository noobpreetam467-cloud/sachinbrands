import Link from "next/link";
import { Icon } from "./icon";

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="sb-page-heading" data-reveal>
      <Link className="sb-back-link" href="/"><Icon name="arrow-left" size={16} /> Home</Link>
      <span className="sb-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
