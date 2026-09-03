"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { saveQuoteBuilderAction } from "@/app/(dashboard)/quotes/builder-actions";
import { computeQuote, type QuoteComputed } from "@/lib/quotes/compute";
import {
  builderFingerprint,
  newCharge,
  newStop,
  newTrip,
  newVehicle,
  toBuilderState,
} from "@/lib/quotes/builder-model";
import type { QuoteBuilderData } from "@/lib/queries/quote-builder";
import type {
  QuoteBuilderInput,
  QuoteChargeInput,
  QuoteHeaderInput,
  QuotePaymentMethodInput,
  QuoteStopInput,
  QuoteTripInput,
  QuoteVehicleInput,
} from "@/lib/validations/quote-builder";
import type { PaymentMethodKind } from "@/types/database";

export type BuilderLookups = {
  salesReps: { id: string; name: string }[];
  garages: { id: string; name: string; address: string | null }[];
  contractTerms: { id: string; name: string; body: string; is_default: boolean }[];
  vehicleTypes: {
    id: string;
    name: string;
    default_capacity: number | null;
    base_rate: number;
    per_km_rate: number;
    per_hour_rate: number;
    per_day_rate: number;
  }[];
  vehicles: {
    id: string;
    name: string;
    capacity: number;
    vehicle_type_id: string | null;
  }[];
  province: string | null;
  gstNumber: string | null;
};

type Reindexed<T extends { position: number }> = T;

function reindex<T extends { position: number }>(rows: T[]): Reindexed<T>[] {
  return rows.map((row, index) => ({ ...row, position: index }));
}

type BuilderValue = {
  quoteId: string;
  quoteNumber: string | null;
  state: QuoteBuilderInput;
  computed: QuoteComputed;
  currency: string;
  timezone: string;
  canEdit: boolean;
  lookups: BuilderLookups;
  publicUrl: string;

  saving: boolean;
  dirty: boolean;
  lastSavedAt: string | null;
  error: string | null;
  save: () => Promise<boolean>;

  setHeader: (patch: Partial<QuoteHeaderInput>) => void;

  activeTripId: string;
  setActiveTripId: (id: string) => void;

  setTrip: (tripId: string, patch: Partial<QuoteTripInput>) => void;
  addTrip: () => void;
  removeTrip: (tripId: string) => void;

  setStop: (tripId: string, stopId: string, patch: Partial<QuoteStopInput>) => void;
  addStop: (tripId: string) => void;
  removeStop: (tripId: string, stopId: string) => void;
  reorderStops: (tripId: string, stops: QuoteStopInput[]) => void;

  setVehicle: (
    tripId: string,
    vehicleId: string,
    patch: Partial<QuoteVehicleInput>,
  ) => void;
  addVehicle: (tripId: string) => void;
  removeVehicle: (tripId: string, vehicleId: string) => void;

  setCharge: (
    tripId: string,
    chargeId: string,
    patch: Partial<QuoteChargeInput>,
  ) => void;
  addCharge: (tripId: string, section: QuoteChargeInput["section"]) => void;
  removeCharge: (tripId: string, chargeId: string) => void;

  setPaymentMethod: (
    method: PaymentMethodKind,
    patch: Partial<QuotePaymentMethodInput>,
  ) => void;
};

const BuilderContext = createContext<BuilderValue | null>(null);

export function useBuilder(): BuilderValue {
  const value = useContext(BuilderContext);
  if (!value) throw new Error("useBuilder must be used inside QuoteBuilderProvider");
  return value;
}

export function QuoteBuilderProvider({
  data,
  lookups,
  currency,
  timezone,
  canEdit,
  quoteNumber,
  publicUrl,
  children,
}: {
  data: QuoteBuilderData;
  lookups: BuilderLookups;
  currency: string;
  timezone: string;
  canEdit: boolean;
  quoteNumber: string | null;
  publicUrl: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<QuoteBuilderInput>(() => toBuilderState(data));
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    builderFingerprint(toBuilderState(data)),
  );
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTripId, setActiveTripId] = useState(
    () => state.trips[0]?.id ?? "",
  );

  const computed = useMemo(() => computeQuote(state), [state]);
  const fingerprint = useMemo(() => builderFingerprint(state), [state]);
  const dirty = fingerprint !== savedFingerprint;

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const inFlight = useRef(false);

  const save = useCallback(async (): Promise<boolean> => {
    if (!canEdit || inFlight.current) return false;
    const snapshot = stateRef.current;
    const fp = builderFingerprint(snapshot);
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await saveQuoteBuilderAction(snapshot);
      if (result.ok) {
        setSavedFingerprint(fp);
        setLastSavedAt(result.savedAt);
        return true;
      }
      setError(result.message);
      return false;
    } catch {
      setError("Could not reach the server. Your changes are not saved.");
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [canEdit]);

  // Debounced autosave — 1.5s after the operator stops changing things.
  useEffect(() => {
    if (!canEdit || !dirty) return;
    const timer = setTimeout(() => void save(), 1500);
    return () => clearTimeout(timer);
  }, [fingerprint, dirty, canEdit, save]);

  // Warn on navigating away with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const mutateTrip = useCallback(
    (tripId: string, fn: (trip: QuoteTripInput) => QuoteTripInput) => {
      setState((s) => ({
        ...s,
        trips: s.trips.map((trip) => (trip.id === tripId ? fn(trip) : trip)),
      }));
    },
    [],
  );

  const value: BuilderValue = {
    quoteId: state.id,
    quoteNumber,
    state,
    computed,
    currency,
    timezone,
    canEdit,
    lookups,
    publicUrl,
    saving,
    dirty,
    lastSavedAt,
    error,
    save,
    activeTripId,
    setActiveTripId,

    setHeader: (patch) =>
      setState((s) => ({ ...s, header: { ...s.header, ...patch } })),

    setTrip: (tripId, patch) => mutateTrip(tripId, (trip) => ({ ...trip, ...patch })),

    addTrip: () =>
      setState((s) => {
        const trip = newTrip(
          s.trips.length,
          lookups.province,
          lookups.gstNumber,
        );
        setActiveTripId(trip.id);
        return { ...s, trips: [...s.trips, trip] };
      }),

    removeTrip: (tripId) =>
      setState((s) => {
        if (s.trips.length <= 1) return s;
        const trips = reindex(s.trips.filter((trip) => trip.id !== tripId)).map(
          (trip, index) => ({ ...trip, name: renumber(trip.name, index) }),
        );
        if (activeTripId === tripId) setActiveTripId(trips[0]!.id);
        return { ...s, trips };
      }),

    setStop: (tripId, stopId, patch) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        stops: trip.stops.map((stop) =>
          stop.id === stopId ? { ...stop, ...patch } : stop,
        ),
      })),

    addStop: (tripId) =>
      mutateTrip(tripId, (trip) => {
        const dropoffIndex = trip.stops.findIndex((s) => s.kind === "DROPOFF");
        const insertAt = dropoffIndex === -1 ? trip.stops.length : dropoffIndex;
        const next = [...trip.stops];
        next.splice(insertAt, 0, newStop(insertAt, "STOP"));
        return { ...trip, stops: reindex(next) };
      }),

    removeStop: (tripId, stopId) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        stops: reindex(trip.stops.filter((stop) => stop.id !== stopId)),
      })),

    reorderStops: (tripId, stops) =>
      mutateTrip(tripId, (trip) => ({ ...trip, stops: reindex(stops) })),

    setVehicle: (tripId, vehicleId, patch) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        vehicles: trip.vehicles.map((vehicle) =>
          vehicle.id === vehicleId ? { ...vehicle, ...patch } : vehicle,
        ),
      })),

    addVehicle: (tripId) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        vehicles: [...trip.vehicles, newVehicle(trip.vehicles.length)],
      })),

    removeVehicle: (tripId, vehicleId) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        vehicles: reindex(
          trip.vehicles.filter((vehicle) => vehicle.id !== vehicleId),
        ),
      })),

    setCharge: (tripId, chargeId, patch) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        charges: trip.charges.map((charge) =>
          charge.id === chargeId ? { ...charge, ...patch } : charge,
        ),
      })),

    addCharge: (tripId, section) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        charges: [...trip.charges, newCharge(section, trip.charges.length)],
      })),

    removeCharge: (tripId, chargeId) =>
      mutateTrip(tripId, (trip) => ({
        ...trip,
        charges: trip.charges.filter((charge) => charge.id !== chargeId),
      })),

    setPaymentMethod: (method, patch) =>
      setState((s) => ({
        ...s,
        paymentMethods: s.paymentMethods.map((entry) =>
          entry.method === method ? { ...entry, ...patch } : entry,
        ),
      })),
  };

  return <BuilderContext value={value}>{children}</BuilderContext>;
}

/** Keep a trip called "Trip 3" in step with its slot after a sibling is removed. */
function renumber(name: string, index: number): string {
  return /^Trip \d+$/.test(name) ? `Trip ${index + 1}` : name;
}
