"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The contents list for the handbook.
 *
 * A long page of instructions is only useful if you can get to the one part you
 * came for, so this stays on screen and marks where you are. The links are real
 * anchors: they work before the JavaScript loads, they can be copied and sent
 * to somebody, and the browser's own find-on-page still reaches every section
 * because nothing here is hidden behind a tab.
 */
export function GuideNav({
  sections,
}: {
  sections: { id: string; title: string }[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) return;

    // The top quarter of the viewport is the "you are here" band. Without a
    // bottom margin every section below the fold counts as visible at once and
    // the last one always wins.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Contents" className="lg:sticky lg:top-6">
      <p className="mb-2 px-2 text-[11px] font-semibold tracking-wide text-ash uppercase">
        Contents
      </p>
      <ul className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
        {sections.map((section) => {
          const current = active === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-body-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500",
                  current
                    ? "bg-teal-50 font-semibold text-teal-700"
                    : "text-slate hover:bg-mist hover:text-ink",
                )}
              >
                {section.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
