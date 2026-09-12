"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useListParams } from "@/lib/hooks/use-list-params";
import { ROWS_PER_PAGE_OPTIONS } from "@/lib/list-params";
import { cn } from "@/lib/utils";

/**
 * Numbered pages rather than infinite scroll, because these lists are worked
 * through rather than browsed: a dispatcher clearing unassigned reservations
 * needs to know they are on page 3 of 7 and can come back to it.
 */
export function TablePagination({
  page,
  pageCount,
  perPage,
}: {
  page: number;
  pageCount: number;
  perPage: number;
}) {
  const { setParams } = useListParams();

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-medium text-carbon">
          Rows per page:
        </span>
        <Popover>
          <PopoverTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-ink transition-colors hover:bg-mist">
            {perPage}
            <ChevronRight className="size-3.5 rotate-90 text-ash" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-24 p-1.5">
            {ROWS_PER_PAGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setParams({ per: String(option), page: null })}
                className={cn(
                  "w-full rounded-lg px-2.5 py-1.5 text-left text-body-sm transition-colors hover:bg-mist",
                  option === perPage
                    ? "bg-orange-50 font-medium text-orange-700"
                    : "text-carbon",
                )}
              >
                {option}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <PageArrow
          direction="previous"
          disabled={page <= 1}
          onClick={() => setParams({ page: String(page - 1) }, { keepPage: true })}
        />

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-[12.5px] text-ash">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              aria-current={entry === page ? "page" : undefined}
              onClick={() => setParams({ page: String(entry) }, { keepPage: true })}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-[12.5px] font-medium transition-colors",
                entry === page
                  ? "bg-teal-500 text-signal-white"
                  : "text-carbon hover:bg-mist",
              )}
            >
              {entry}
            </button>
          ),
        )}

        <PageArrow
          direction="next"
          disabled={page >= pageCount}
          onClick={() => setParams({ page: String(page + 1) }, { keepPage: true })}
        />
      </nav>
    </>
  );
}

function PageArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} page`}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        disabled
          ? "cursor-not-allowed text-fog"
          : "text-carbon hover:bg-teal-500 hover:text-signal-white",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** 1 … 4 5 [6] 7 8 … 20 — always shows the first and last page. */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, page]);
  for (let offset = 1; offset <= 2; offset += 1) {
    if (page - offset > 1) pages.add(page - offset);
    if (page + offset < pageCount) pages.add(page + offset);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];

  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) result.push("gap");
    result.push(value);
  });

  return result;
}
