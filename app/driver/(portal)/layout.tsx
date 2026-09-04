import { DriverNav } from "@/components/driver/driver-nav";
import { requireDriver } from "@/lib/auth/session";

/**
 * Every portal page reads the signed-in driver's own live data, so nothing
 * here may be prerendered or shared between users.
 */
export const dynamic = "force-dynamic";

export default async function DriverPortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { driver } = await requireDriver();
  const name =
    [driver.first_name, driver.last_name].filter(Boolean).join(" ") || "Driver";

  return (
    <div className="min-h-dvh bg-app">
      <DriverNav name={name} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
