"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CustomerHit } from "@/app/(dashboard)/quotes/builder-actions";
import type { QuoteBuilderData } from "@/lib/queries/quote-builder";

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
    <div
      className={cn(
        "group flex items-center gap-1 border-b-2 px-3 pb-3 pt-2",
        active ? "border-interactive" : "border-transparent",
      )}
    >
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
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "font-display text-body-sm font-semibold",
            active ? "text-ink" : "text-ash hover:text-slate",
          )}
        >
          {name}
        </button>
      )}
      {active && canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-ash opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Rename trip"
        >
          <Pencil className="size-3" />
        </button>
      )}
      {active && canDelete && (
        <button
          type="button"
          onClick={() => removeTrip(tripId)}
          className="text-ash opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label="Delete trip"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  );
}

function BuilderShell({
  createdAt,
  initialCustomer,
  initialBilling,
}: {
  createdAt: string | null;
  initialCustomer: CustomerHit | null;
  initialBilling: CustomerHit | null;
}) {
  const { state, activeTripId, setActiveTripId, addTrip, canEdit, error } =
    useBuilder();
  const [section, setSection] = useState<Section>("trip");

  const activeTrip =
    state.trips.find((trip) => trip.id === activeTripId) ?? state.trips[0]!;

  const tabClass = (on: boolean) =>
    cn(
      "border-b-2 px-3 pb-3 pt-2 font-display text-body-sm font-semibold transition-colors",
      on
        ? "border-interactive text-ink"
        : "border-transparent text-ash hover:text-slate",
    );

  return (
    <div className="space-y-4">
      <Link
        href="/quotes"
        className="inline-block text-body-sm font-semibold text-interactive hover:underline"
      >
        ‹ Quotes
      </Link>

      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        {/* Left rail */}
        <aside className="rounded-2xl border border-bone bg-signal-white p-5 lg:sticky lg:top-20">
          <p className="mb-4 font-display text-body font-bold text-ink">
            {state.header.title}
          </p>
          <BuilderSidebar createdAt={createdAt} />
        </aside>

        {/* Main */}
        <div className="min-w-0 space-y-4">
          <BuilderTopbar />

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-body-sm text-destructive">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-bone bg-signal-white">
            {/* Top tab bar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-bone px-4">
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
                  className="ml-2 inline-flex items-center gap-1 px-2 py-2 text-body-sm font-semibold text-interactive"
                >
                  <Plus className="size-4" /> Add Trip
                </button>
              )}
            </div>

            <div className="p-5 sm:p-6">
              {section === "customer" && (
                <CustomerTab
                  initialCustomer={initialCustomer}
                  initialBilling={initialBilling}
                />
              )}
              {section === "trip" && (
                <TripTab key={activeTrip.id} trip={activeTrip} />
              )}
              {section === "payment" && <PaymentTab />}
              {section === "notes" && <NotesTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuoteBuilder({
  data,
  lookups,
  currency,
  timezone,
  canEdit,
  quoteNumber,
  publicUrl,
  createdAt,
  initialCustomer,
  initialBilling,
}: {
  data: QuoteBuilderData;
  lookups: BuilderLookups;
  currency: string;
  timezone: string;
  canEdit: boolean;
  quoteNumber: string | null;
  publicUrl: string;
  createdAt: string | null;
  initialCustomer: CustomerHit | null;
  initialBilling: CustomerHit | null;
}) {
  return (
    <QuoteBuilderProvider
      data={data}
      lookups={lookups}
      currency={currency}
      timezone={timezone}
      canEdit={canEdit}
      quoteNumber={quoteNumber}
      publicUrl={publicUrl}
    >
      <BuilderShell
        createdAt={createdAt}
        initialCustomer={initialCustomer}
        initialBilling={initialBilling}
      />
    </QuoteBuilderProvider>
  );
}
