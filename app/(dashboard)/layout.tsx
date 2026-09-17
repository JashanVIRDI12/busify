import { AssistantLauncher } from "@/components/ai/assistant-launcher";
import { TopNav } from "@/components/shell/top-nav";
import { aiConfigured } from "@/lib/ai/client";
import { requireSession } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";

/**
 * Every console route reads the caller's session and their organization's live
 * data, so none of it may be prerendered or shared between users.
 */
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, organization, role } = await requireSession();

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <TopNav
        organizationName={organization.name}
        userName={fullName}
        userEmail={user.email ?? ""}
        roleLabel={ROLE_LABELS[role]}
      />

      {/* Data tables run wide; the page itself never centres or caps them, so a
          1440px dispatch board uses the whole screen the operator paid for. */}
      <main className="flex-1 px-4 pt-5 pb-10 sm:px-6">{children}</main>

      {aiConfigured() && <AssistantLauncher />}
    </div>
  );
}
