import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not available",
  robots: { index: false, follow: false },
};

export default function NotAvailable() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <h1 className="text-3xl font-semibold text-foreground">Not available in your region</h1>
      <p className="mt-3 max-w-md text-[var(--ink-secondary)]">
        This website is not accessible from your location.
      </p>
    </div>
  );
}
