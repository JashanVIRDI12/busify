import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shaped like the list screens it stands in for — a title, a filter row, a
 * table — so the page does not visibly jump when the data lands.
 */
export default function ConsoleLoading() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="mb-3.5 flex gap-2.5">
        <Skeleton className="h-[46px] w-[248px]" />
        <Skeleton className="h-[46px] w-[172px]" />
        <Skeleton className="h-[46px] w-[172px]" />
      </div>

      <div className="panel p-4">
        <Skeleton className="mb-3 h-9 w-full" />
        {Array.from({ length: 8 }, (_, row) => (
          <Skeleton key={row} className="mb-2 h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
