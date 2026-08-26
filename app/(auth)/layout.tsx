import Link from "next/link";

import { Logo } from "@/components/shared/logo";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <header className="px-6 py-6">
        <Link href="/" className="inline-flex rounded-xl outline-none">
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pt-4 pb-20 sm:items-center sm:pt-0 sm:pb-24">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>
    </div>
  );
}
