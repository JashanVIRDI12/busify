import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type BreakdownRow = {
  label: string;
  value: number;
  tone: "success" | "primary" | "warning" | "muted" | "secondary";
};

const BAR_TONE = {
  success: "bg-emerald",
  primary: "bg-interactive",
  warning: "bg-amber",
  secondary: "bg-fog",
  muted: "bg-cloud",
} as const;

export function BreakdownCard({
  title,
  total,
  totalLabel,
  rows,
  emptyMessage,
}: {
  title: string;
  total: number;
  totalLabel: string;
  rows: BreakdownRow[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="tabular text-[12px] text-ash">
          {total} {totalLabel}
        </span>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-4 text-body-sm text-ash">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3.5">
            {rows.map((row) => {
              const percent = total > 0 ? (row.value / total) * 100 : 0;
              return (
                <li key={row.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-body-sm">
                    <span className="text-slate">{row.label}</span>
                    <span className="tabular font-semibold text-ink">{row.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-plaster">
                    <div
                      className={cn("h-full rounded-full", BAR_TONE[row.tone])}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
