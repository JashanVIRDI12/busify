"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";
import { TripDetails } from "./trip-details";
import { TripNotes } from "./trip-notes";
import { TripPricing } from "./trip-pricing";
import { TripRecurrence } from "./trip-recurrence";

type SubTab = "details" | "pricing" | "notes" | "recurrence";

export function TripTab({ trip }: { trip: QuoteTripInput }) {
  const { computed, currency } = useBuilder();
  const [sub, setSub] = useState<SubTab>("details");
  const result = computed.byTrip[trip.id];

  return (
    <Tabs value={sub} onValueChange={(value) => setSub(value as SubTab)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="recurrence">Recurrence</TabsTrigger>
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
    </Tabs>
  );
}
