import Link from "next/link";

import { AssistantLauncher } from "@/components/ai/assistant-launcher";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { OrgBadge } from "@/components/dashboard/org-badge";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/shared/logo";
import { aiConfigured } from "@/lib/ai/client";
import { requireSession } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";

/**
 * Every dashboard route reads the caller's session and their organization's
 * live data, so none of it may be prerendered or shared between users.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, organization, role } = await requireSession();

  const orgBadge = <OrgBadge organization={organization} role={role} />;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  return (
    // Marketing pages sit on pure white; the app sits on Mist so white panels
    // with hairline borders still separate at dashboard density.
    <div className="flex min-h-dvh bg-app">
      <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 flex-col border-r border-bone bg-signal-white lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href="/dashboard" className="rounded-xl outline-none">
            <Logo />
          </Link>
        </div>
        {orgBadge}
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="shrink-0 border-t border-bone px-5 py-4">
          <p className="meta-label">Phase 2 · Quotes</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-bone bg-signal-white/85 px-5 backdrop-blur-md sm:px-8">
          <MobileNav header={orgBadge} />
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu
              name={fullName}
              email={user.email ?? ""}
              roleLabel={ROLE_LABELS[role]}
            />
          </div>
        </header>

        <main className="flex-1 px-5 py-8 sm:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[80rem]">{children}</div>
        </main>

        {/* Available on every page, so the operator never navigates away to ask. */}
        {aiConfigured() && <AssistantLauncher />}
      </div>
    </div>
  );
}
