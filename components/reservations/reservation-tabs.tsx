"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Panel = {
  value: string;
  label: string;
  /** Rendered on the server and handed down, so switching costs no fetch. */
  content: React.ReactNode;
  /** Shown beside the label, e.g. an open ticket count. */
  badge?: number;
};

/**
 * The reservation's panels.
 *
 * Every panel's content is rendered on the server and passed in, so this is a
 * client component purely to remember which one is showing. Switching a tab
 * costs nothing — no request, no spinner — which matters more here than
 * usual, because the database is far enough away that a tab which fetched on
 * open would feel like a page load.
 */
export function ReservationTabs({ panels }: { panels: Panel[] }) {
  return (
    <Tabs defaultValue={panels[0]?.value}>
      <TabsList className="w-full justify-start overflow-x-auto">
        {panels.map((panel) => (
          <TabsTrigger key={panel.value} value={panel.value} className="gap-1.5">
            {panel.label}
            {panel.badge !== undefined && panel.badge > 0 && (
              <span className="rounded-full bg-teal-100 px-1.5 text-[10px] font-semibold text-teal-700">
                {panel.badge}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {panels.map((panel) => (
        <TabsContent key={panel.value} value={panel.value} className="mt-4">
          {panel.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
