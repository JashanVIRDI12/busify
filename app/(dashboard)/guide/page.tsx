import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Hammer } from "lucide-react";

import { GuideNav } from "@/components/guide/guide-nav";
import { PageHeader } from "@/components/shared/page-header";
import { STATUS_REFERENCE, StatusPill } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/session";
import { GUIDE_SECTIONS, type GuideSection } from "@/lib/guide";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import type { OrgRole } from "@/types/database";

export const metadata: Metadata = { title: "How it works" };

/** Printed as a legend, in the order an operator meets them. */
const STATUS_GROUPS = [
  { title: "Trip requests", statuses: STATUS_REFERENCE.TRIP_REQUEST },
  { title: "Reservations", statuses: STATUS_REFERENCE.TRIP },
  { title: "Vehicles", statuses: STATUS_REFERENCE.VEHICLE },
  { title: "Drivers", statuses: STATUS_REFERENCE.DRIVER },
] as const;

const ROLES: OrgRole[] = [
  "OWNER",
  "ADMIN",
  "DISPATCHER",
  "STAFF",
  "ACCOUNTANT",
  "DRIVER",
];

function Section({
  section,
  activeRole,
}: {
  section: GuideSection;
  activeRole: OrgRole;
}) {
  const Icon = section.icon;

  return (
    <section
      id={section.id}
      // Clears the sticky header when the browser jumps to an anchor, so the
      // heading you asked for is not hidden underneath it.
      className="scroll-mt-24 border-t border-bone pt-8 first:border-t-0 first:pt-0"
    >
      <h2 className="flex items-center gap-2.5 text-heading-sm font-semibold text-ink">
        <Icon className="size-5 shrink-0 text-teal-600" aria-hidden="true" />
        {section.title}
        {section.unbuilt && (
          <Badge variant="outline" className="gap-1">
            <Hammer className="size-3" aria-hidden="true" />
            Not built yet
          </Badge>
        )}
      </h2>

      <p className="mt-2 max-w-[68ch] text-body text-slate">{section.summary}</p>

      {section.steps.length > 0 && (
        <dl className="mt-5 space-y-4">
          {section.steps.map((step) => (
            <div key={step.title} className="max-w-[72ch]">
              <dt className="text-body-sm font-semibold text-ink">
                {step.title}
              </dt>
              <dd className="mt-0.5 text-body-sm text-slate">{step.body}</dd>
            </div>
          ))}
        </dl>
      )}

      {/*
        Two sections render live lookups rather than prose, so that renaming a
        status or a role updates the handbook without anyone remembering to.
      */}
      {section.id === "statuses" && (
        <div className="mt-5 space-y-5">
          {STATUS_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-body-sm font-semibold text-ink">
                {group.title}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {Object.entries(group.statuses).map(([key, entry]) => (
                  <li key={key}>
                    <StatusPill label={entry.label} tone={entry.tone} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* The roles table is the one section whose content is a live lookup. */}
      {section.id === "roles" && (
        <ul className="mt-5 space-y-2">
          {ROLES.map((role) => (
            <li
              key={role}
              className="flex max-w-[72ch] flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <span className="text-body-sm font-semibold text-ink">
                {ROLE_LABELS[role]}
              </span>
              {role === activeRole && (
                <Badge variant="secondary" className="text-[10px]">
                  you
                </Badge>
              )}
              <span className="text-body-sm text-slate">
                {ROLE_DESCRIPTIONS[role]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {section.notes && section.notes.length > 0 && (
        <ul className="mt-5 max-w-[72ch] space-y-2 rounded-xl border border-bone bg-mist/50 p-4">
          {section.notes.map((note) => (
            <li key={note} className="text-body-sm text-slate">
              {note}
            </li>
          ))}
        </ul>
      )}

      {section.links && section.links.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-full border border-bone bg-signal-white px-3 py-1.5 text-body-sm font-medium text-ink transition-colors hover:border-cloud hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            >
              {link.label}
              <ArrowRight className="size-3.5 text-ash" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The handbook: what the product does, in the order somebody meets it.
 *
 * One long page rather than a set of tabbed panels, so that browser find, a
 * copied anchor link and printing all reach the whole thing. The contents list
 * beside it is what makes the length navigable.
 */
export default async function GuidePage() {
  const { organization, role } = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="How it works"
        description={`Everything ${organization.name} can do, start to finish. Jump to a section from the contents.`}
      />

      <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
        <GuideNav
          sections={GUIDE_SECTIONS.map(({ id, title }) => ({ id, title }))}
        />

        <div className="space-y-8">
          {GUIDE_SECTIONS.map((section) => (
            <Section key={section.id} section={section} activeRole={role} />
          ))}
        </div>
      </div>
    </div>
  );
}
