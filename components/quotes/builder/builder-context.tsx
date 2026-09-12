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
import { useRouter } from "next/navigation";

import { saveQuoteBuilderAction } from "@/app/(dashboard)/quotes/builder-actions";
import { computeQuote, type QuoteComputed } from "@/lib/quotes/compute";
import {
  builderFingerprint,
  newCharge,
  newStop,
  newTrip,
  newVehicle,
} from "@/lib/quotes/builder-model";
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
  /** From Settings → General → Defaults, not a fixed list in the code. */
  eventTypes: string[];
  /** Reusable itemised charges from Settings → Custom Charges. */
  customCharges: {
    id: string;
    name: string;
    rate_type: "FLAT" | "PER_QUANTITY" | "PERCENTAGE";
    rate: number;
    tax_exempt: boolean;
  }[];
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
  initialState,
  lastSavedAt: initialSavedAt,
  lookups,
  currency,
  timezone,
  canEdit,
  quoteNumber,
  publicUrl,
  children,
}: {
  initialState: QuoteBuilderInput;
  /** null for a quote that has never been saved — i.e. /quotes/new. */
  lastSavedAt: string | null;
  lookups: BuilderLookups;
  currency: string;
  timezone: string;
  canEdit: boolean;
  quoteNumber: string | null;
  publicUrl: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<QuoteBuilderInput>(initialState);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    // An unsaved quote must read as dirty immediately: comparing it against its
    // own opening state would leave Save disabled on a quote that does not
    // exist yet. A sentinel no real fingerprint can equal does that.
    initialSavedAt === null ? "" : builderFingerprint(initialState),
  );
  const [saving, setSaving] = useState(false);
  // A quote reopened days later was saved then, not "never".
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialSavedAt);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isNew = useRef(initialSavedAt === null);
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
        // The first save is what turned /quotes/new into a real quote. Swap the
        // URL for the one the operator can bookmark, share and reload, without
        // a navigation that would throw away the state they just saved.
        if (isNew.current) {
          isNew.current = false;
          router.replace(`/quotes/${snapshot.id}`);
        }
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
  }, [canEdit, router]);

  // Debounced autosave — 1.5s after the operator stops changing things.
  //
  // Never before the first save, though. A quote on /quotes/new reads as dirty
  // from the moment it mounts, so autosaving it would create the row 1.5s after
  // the operator arrived and put an empty Lead back in the pipeline — the exact
  // thing opening the builder without writing was meant to stop. The first save
  // is deliberate; autosave takes over once the quote actually exists.
  useEffect(() => {
    if (!canEdit || !dirty || isNew.current) return;
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
