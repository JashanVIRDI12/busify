"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

import { QUOTE_PIPELINE_STATUS, StatusPill, pillFor } from "@/components/data/status-pill";
import type { QuoteFile } from "@/components/quotes/builder/files-panel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CustomerHit } from "@/app/(dashboard)/quotes/builder-actions";
import type { QuoteBuilderInput } from "@/lib/validations/quote-builder";

import {
  QuoteBuilderProvider,
  useBuilder,
  type BuilderLookups,
} from "./builder-context";
import { BuilderSidebar } from "./builder-sidebar";
import { BuilderTopbar } from "./builder-topbar";
import { CustomerTab } from "./customer-tab";
import { NotesTab } from "./notes-tab";
import { PaymentTab } from "./payment-tab";
import { TripTab } from "./trip-tab";

type Section = "customer" | "trip" | "payment" | "notes";

/**
 * The tab strip sits on the page background with the active tab drawn as a
 * white chip that merges into the panel below it. That is what makes the tabs
 * read as pages of one document rather than as a row of filters.
 */
const TAB_BASE =
  "relative -mb-px rounded-t-[10px] px-4 py-2 text-body-sm transition-colors";

function tabClass(active: boolean) {
  return cn(
    TAB_BASE,
    active
      ? "bg-signal-white font-semibold text-ink"
      : "text-slate hover:text-ink",
  );
}

function TripTabButton({
  tripId,
  name,
  active,
  onSelect,
}: {
  tripId: string;
  name: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { state, setTrip, removeTrip, canEdit } = useBuilder();
  const [editing, setEditing] = useState(false);
  const canDelete = canEdit && state.trips.length > 1;

  return (
    <div className={cn(tabClass(active), "group flex items-center gap-1.5")}>
      {editing ? (
        <Input
          autoFocus
          defaultValue={name}
          className="h-7 w-28 px-2 text-body-sm"
          onBlur={(event) => {
            setTrip(tripId, { name: event.target.value.trim() || name });
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      ) : (
        <button type="button" onClick={onSelect}>
          {name}
        </button>
      )}

      {active && canEdit && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-ash opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Rename ${name}`}
        >
          <Pencil className="size-3" />
        </button>
      )}
      {active && canDelete && !editing && (
        <button
          type="button"
          onClick={() => removeTrip(tripId)}
          className="text-ash opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  );
}

function BuilderShell({
  quoteId,
  organizationId,
  createdAt,
  updatedAt,
  files,
  initialCustomer,
  initialBilling,
}: {
  quoteId: string;
  organizationId: string;
  createdAt: string | null;
  updatedAt: string | null;
  files: QuoteFile[];
  initialCustomer: CustomerHit | null;
  initialBilling: CustomerHit | null;
}) {
  const { state, activeTripId, setActiveTripId, addTrip, canEdit, error } =
    useBuilder();
  const [section, setSection] = useState<Section>("customer");
  const [railOpen, setRailOpen] = useState(true);

  const activeTrip =
    state.trips.find((trip) => trip.id === activeTripId) ?? state.trips[0]!;
  const status = pillFor(QUOTE_PIPELINE_STATUS, state.header.pipeline_status);

  return (
    // Full-bleed out of the page padding: the rail is chrome, and inset chrome
    // with a gutter behind it reads as a floating card rather than a sidebar.
    <div className="-mx-4 -mt-5 -mb-10 flex min-h-[calc(100dvh-3.5rem)] sm:-mx-6">
      {railOpen && (
        <aside className="hidden w-[15rem] shrink-0 border-r border-bone bg-signal-white px-5 py-4 lg:block">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link
              href="/quotes"
              className="inline-flex items-center text-body-sm font-medium text-carbon hover:text-ink"
            >
              <ChevronLeft className="size-4" />
              Quotes
            </Link>
            <StatusPill label={status.label} tone={status.tone} />
          </div>

          <p className="mb-3 truncate text-body-sm font-semibold text-ink">
            {state.header.title}
          </p>

          <div className="mb-3 border-t border-bone" />

          <BuilderSidebar
            quoteId={quoteId}
            organizationId={organizationId}
            createdAt={createdAt}
            updatedAt={updatedAt}
            files={files}
          />
        </aside>
      )}

      <div className="min-w-0 flex-1 px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <BuilderTopbar />
          </div>

          <button
            type="button"
            onClick={() => setRailOpen((open) => !open)}
            aria-label={railOpen ? "Hide the quote details" : "Show the quote details"}
            className="hidden size-8 shrink-0 items-center justify-center rounded-full border border-bone bg-signal-white text-slate transition-colors hover:text-ink lg:flex"
          >
            {railOpen ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2 text-body-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-1">
          <button
            type="button"
            className={tabClass(section === "customer")}
            onClick={() => setSection("customer")}
          >
            Customer
          </button>

          {state.trips.map((trip) => (
            <TripTabButton
              key={trip.id}
              tripId={trip.id}
              name={trip.name}
              active={section === "trip" && activeTripId === trip.id}
              onSelect={() => {
                setActiveTripId(trip.id);
                setSection("trip");
              }}
            />
          ))}

          <button
            type="button"
            className={tabClass(section === "payment")}
            onClick={() => setSection("payment")}
          >
            Payment
          </button>
          <button
            type="button"
            className={tabClass(section === "notes")}
            onClick={() => setSection("notes")}
          >
            Notes
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                addTrip();
                setSection("trip");
              }}
              className="ml-1 inline-flex items-center gap-1 px-3 py-2 text-body-sm font-medium text-orange-600 hover:text-orange-700"
            >
              <Plus className="size-4" /> Add Trip
            </button>
          )}
        </div>

        <div className="panel min-h-[32rem] p-5 sm:p-6">
          {section === "customer" && (
            <CustomerTab
              initialCustomer={initialCustomer}
              initialBilling={initialBilling}
            />
          )}
          {section === "trip" && <TripTab key={activeTrip.id} trip={activeTrip} />}
          {section === "payment" && <PaymentTab />}
          {section === "notes" && <NotesTab />}
        </div>
      </div>
    </div>
  );
}

export function QuoteBuilder({
  initialState,
  lookups,
  currency,
  timezone,
  canEdit,
  quoteNumber,
  publicUrl,
  organizationId,
  createdAt,
  updatedAt,
  files,
  initialCustomer,
  initialBilling,
}: {
  initialState: QuoteBuilderInput;
  lookups: BuilderLookups;
  currency: string;
  timezone: string;
  canEdit: boolean;
  quoteNumber: string | null;
  publicUrl: string;
  organizationId: string;
  createdAt: string | null;
  updatedAt: string | null;
  files: QuoteFile[];
  initialCustomer: CustomerHit | null;
  initialBilling: CustomerHit | null;
}) {
  return (
    <QuoteBuilderProvider
      initialState={initialState}
      lastSavedAt={updatedAt}
      lookups={lookups}
      currency={currency}
      timezone={timezone}
      canEdit={canEdit}
      quoteNumber={quoteNumber}
      publicUrl={publicUrl}
    >
      <BuilderShell
        quoteId={initialState.id}
        organizationId={organizationId}
        createdAt={createdAt}
        updatedAt={updatedAt}
        files={files}
        initialCustomer={initialCustomer}
        initialBilling={initialBilling}
      />
    </QuoteBuilderProvider>
  );
}
