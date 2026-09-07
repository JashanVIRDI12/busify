import Link from "next/link";

import { BrandMark } from "@/components/shell/brand-mark";

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <header className="px-6 py-6">
        <Link href="/" className="inline-flex rounded-xl outline-none">
          <BrandMark />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-2 pb-24">
        {children}
      </main>
    </div>
  );
}
