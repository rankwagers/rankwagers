import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Internal Intelligence",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
  other: {
    robots: "noindex, nofollow, noarchive",
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
