import { SettingsRail } from "@/components/settings/settings-rail";

/**
 * Settings runs full-bleed with its own rail, the same shape as the quote
 * builder: the navigation is chrome, and inset chrome with a gutter behind it
 * reads as a floating card rather than a section of the app.
 */
export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="-mx-4 -mt-5 -mb-10 flex min-h-[calc(100dvh-3.5rem)] sm:-mx-6">
      <aside className="hidden w-[13rem] shrink-0 border-r border-bone bg-signal-white px-4 py-5 lg:block">
        <SettingsRail />
      </aside>

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
