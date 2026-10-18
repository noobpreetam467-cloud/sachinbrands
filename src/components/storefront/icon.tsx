import type { ReactNode } from "react";

export type IconName =
  | "search"
  | "heart"
  | "cart"
  | "user"
  | "menu"
  | "close"
  | "arrow"
  | "spark"
  | "shield"
  | "truck"
  | "return"
  | "phone"
  | "audio"
  | "watch"
  | "accessory"
  | "laptop"
  | "game"
  | "star"
  | "check"
  | "mail"
  | "plus"
  | "minus"
  | "trash"
  | "arrow-left";

const paths: Record<IconName, ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  heart: <path d="M20.8 8.7c0 4.2-8.8 10-8.8 10s-8.8-5.8-8.8-10a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z" />,
  cart: <><path d="M3 4h2l2.3 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  truck: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="17.5" cy="19" r="1.5" /></>,
  return: <><path d="M4 4v6h6" /><path d="M5 15a8 8 0 1 0 1-9L4 10" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
  audio: <><path d="M3 13v-2a9 9 0 0 1 18 0v2" /><rect x="3" y="12" width="4" height="7" rx="2" /><rect x="17" y="12" width="4" height="7" rx="2" /></>,
  watch: <><rect x="6" y="7" width="12" height="10" rx="3" /><path d="m9 7 1-4h4l1 4m-6 10 1 4h4l1-4" /></>,
  accessory: <><path d="M8 5 5 8l7 7 7-7-3-3-4 4-4-4Z" /><path d="m7 13-3 3 5 5 3-3" /></>,
  laptop: <><rect x="5" y="4" width="14" height="12" rx="1.5" /><path d="M2 20h20l-2-4H4l-2 4Z" /></>,
  game: <><path d="M7 9h10a5 5 0 0 1 4.8 6.4l-.7 2.3a2 2 0 0 1-3.2 1l-3.2-2.4h-5l-3.2 2.4a2 2 0 0 1-3.2-1l-.7-2.3A5 5 0 0 1 7 9Z" /><path d="M8 12v4m-2-2h4m6-1h.01M18 15h.01" /></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  check: <><path d="m5 12 4 4L19 6" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
  "arrow-left": <><path d="M20 12H5m6 6-6-6 6-6" /></>,
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}
