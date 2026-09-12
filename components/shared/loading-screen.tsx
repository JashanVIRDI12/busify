import { Skeleton } from "@/components/ui/skeleton";

/**
 * The loading state for a route segment: a skeleton shaped like whatever is
 * coming.
 *
 * The skeleton's job is to hold the layout so nothing jumps when the data
 * lands. Get its proportions wrong and the page visibly reflows, which is worse
 * than showing no skeleton at all — so each shape carries the real widths of
 * the thing it stands in for.
 *
 * Shapes are named after what they stand in for rather than how they look, so a
 * route picks the one matching its page and the two stay in step when a layout
 * changes.
 */
export type LoadingShape =
  | "list"
  | "builder"
  | "detail"
  | "settings"
  | "board"
  | "cards";

export function LoadingScreen({
  shape = "list",
  label = "Loading",
}: {
  shape?: LoadingShape;
  label?: string;
}) {
  return (
    // The shape is decorative — it conveys nothing to a screen reader but a
    // pile of empty boxes — so it is hidden from the accessibility tree and the
    // label is announced instead.
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden>{SHAPES[shape]()}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ListShape() {
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

/** The quote builder: a fixed rail, a tab strip, then one tall panel. */
function BuilderShape() {
  return (
    <div className="flex gap-6">
      <div className="hidden w-[13.5rem] shrink-0 space-y-3 lg:block">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 8 }, (_, row) => (
          <Skeleton key={row} className="h-4 w-full" />
        ))}
        <Skeleton className="mt-6 h-4 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-52" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <div className="mb-0 flex gap-2">
          {Array.from({ length: 4 }, (_, tab) => (
            <Skeleton key={tab} className="h-9 w-24 rounded-t-[10px]" />
          ))}
        </div>

        <div className="panel space-y-4 p-6">
          <Skeleton className="h-11 w-full" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

/** A single record: header, a row of facts, then panels. */
function DetailShape() {
  return (
    <div>
      <Skeleton className="mb-2 h-4 w-28" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, card) => (
          <div key={card} className="panel space-y-2 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel space-y-3 p-6">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 6 }, (_, row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
        <div className="panel space-y-3 p-6">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }, (_, row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A settings screen: a heading, then a form or a short table. */
function SettingsShape() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="panel space-y-4 p-6">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ))}
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}

/** Dispatch: controls, then a wide grid of bars. */
function BoardShape() {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="ml-auto h-10 w-40" />
      </div>

      <div className="panel overflow-hidden p-4">
        <div className="mb-3 flex gap-2">
          {Array.from({ length: 7 }, (_, day) => (
            <Skeleton key={day} className="h-8 flex-1" />
          ))}
        </div>
        {Array.from({ length: 7 }, (_, row) => (
          <div key={row} className="mb-2 flex items-center gap-2">
            <Skeleton className="h-10 w-36 shrink-0" />
            <Skeleton
              className="h-10"
              style={{
                marginLeft: `${(row * 7) % 40}%`,
                width: `${25 + ((row * 11) % 35)}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reports and Setup: a headline, then cards. */
function CardsShape() {
  return (
    <div>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-6 h-10 w-80" />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, card) => (
          <div key={card} className="panel space-y-2 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="panel space-y-3 p-6">
        <Skeleton className="h-5 w-44" />
        {Array.from({ length: 5 }, (_, row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

const SHAPES: Record<LoadingShape, () => React.ReactElement> = {
  list: ListShape,
  builder: BuilderShape,
  detail: DetailShape,
  settings: SettingsShape,
  board: BoardShape,
  cards: CardsShape,
};
