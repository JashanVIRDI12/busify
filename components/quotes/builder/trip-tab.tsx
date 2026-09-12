"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";
import { TripDetails } from "./trip-details";
import { TripNotes } from "./trip-notes";
import { TripPricing } from "./trip-pricing";
import { TripRecurrence } from "./trip-recurrence";

type SubTab = "details" | "pricing" | "notes" | "recurrence";

/**
 * In the order a trip is actually built: what the journey is, then what it
 * costs, then anything to say about it, then whether it repeats.
 *
 * The tab strip lets an operator jump anywhere; this order is what Next walks
 * through, for the far more common case of filling a trip in for the first
 * time and not wanting to reach for the mouse between every section.
 */
const SUB_TABS: { value: SubTab; label: string }[] = [
  { value: "details", label: "Details" },
  { value: "pricing", label: "Pricing" },
  { value: "notes", label: "Notes" },
  { value: "recurrence", label: "Recurrence" },
];

export function TripTab({
  trip,
  onBack,
  backLabel,
  onNext,
  nextLabel,
}: {
  trip: QuoteTripInput;
  /** Where Back goes from the *first* sub-tab, so the flow is continuous. */
  onBack?: () => void;
  backLabel?: string;
  /** Where Next goes from the *last* sub-tab. */
  onNext?: () => void;
  nextLabel?: string;
}) {
  const { computed, currency } = useBuilder();
  const [sub, setSub] = useState<SubTab>("details");
  const result = computed.byTrip[trip.id];

  const index = SUB_TABS.findIndex((tab) => tab.value === sub);
  const previous = index > 0 ? SUB_TABS[index - 1] : null;
  const next = index < SUB_TABS.length - 1 ? SUB_TABS[index + 1] : null;

  return (
    <Tabs value={sub} onValueChange={(value) => setSub(value as SubTab)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          {SUB_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {result && (
          <p className="tabular text-body-sm text-slate">
            Trip total{" "}
            <span className="font-semibold text-ink">
              {new Intl.NumberFormat("en-CA", {
                style: "currency",
                currency,
              }).format(result.total / 100)}
            </span>
          </p>
        )}
      </div>

      <div className="pt-6">
        <TabsContent value="details">
          <TripDetails trip={trip} />
        </TabsContent>
        <TabsContent value="pricing">
          <TripPricing trip={trip} />
        </TabsContent>
        <TabsContent value="notes">
          <TripNotes trip={trip} />
        </TabsContent>
        <TabsContent value="recurrence">
          <TripRecurrence trip={trip} />
        </TabsContent>
      </div>

      {/* Separated from the panel above, so it reads as "where do I go next"
          rather than as another control belonging to the section. */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-bone pt-4">
        {/* At either end of the sub-tabs, Back and Next step out to the
            surrounding quote rather than dead-ending, so the whole builder is
            one path an operator can walk without the mouse. */}
        {previous ? (
          <Button variant="outline" onClick={() => setSub(previous.value)}>
            <ArrowLeft />
            {previous.label}
          </Button>
        ) : onBack ? (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft />
            {backLabel ?? "Back"}
          </Button>
        ) : (
          <span />
        )}

        {next ? (
          <Button variant="outline" onClick={() => setSub(next.value)}>
            {next.label}
            <ArrowRight />
          </Button>
        ) : onNext ? (
          <Button variant="outline" onClick={onNext}>
            {nextLabel ?? "Next"}
            <ArrowRight />
          </Button>
        ) : null}
      </div>
    </Tabs>
  );
}
