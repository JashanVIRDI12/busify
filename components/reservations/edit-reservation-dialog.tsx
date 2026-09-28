"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { updateReservationAction } from "@/app/(dashboard)/reservations/actions";
import { FormMessage } from "@/components/auth/form-message";
import { AddressField } from "@/components/quotes/builder/address-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { utcToZonedInputValue } from "@/lib/datetime";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { RESERVATION_TIMES } from "@/lib/reservation-times";
import type { Tables } from "@/types/database";

/**
 * Edit the reservation's own facts after it has been booked.
 *
 * The itinerary's stops stay with the quote that produced them; this is for
 * the changes that come in by phone once the job is on the board — ten more
 * passengers, a later pickup, a different drop-off door.
 */
export function EditReservationDialog({
  trip,
  timeZone,
}: {
  trip: Tables<"trips">;
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);

  const { state, formAction, reset } = useActionForm(updateReservationAction, {
    onSuccess: () => {
      toast.success("Reservation updated.");
      setOpen(false);
    },
  });

  const local = (iso: string | null) => (iso ? utcToZonedInputValue(iso, timeZone) : "");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-2xl"
        onEscapeKeyDown={(event) => {
          // Escape in an open address list closes the list, not the dialog and
          // every edit in it.
          const target = event.target as HTMLElement | null;
          if (target?.getAttribute("aria-expanded") === "true") event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit reservation</DialogTitle>
          <DialogDescription>
            Times are in your organization&rsquo;s timezone ({timeZone.replace(/_/g, " ")}).
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormMessage state={state} />
          <input type="hidden" name="id" value={trip.id} />

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Name" htmlFor="group_name" errors={state.fieldErrors?.group_name}>
              <Input
                id="group_name"
                name="group_name"
                defaultValue={trip.group_name ?? ""}
                placeholder="Grade 11 Toronto Zoo field trip"
              />
            </Field>
            <Field
              label="Passengers"
              htmlFor="passenger_count"
              required
              errors={state.fieldErrors?.passenger_count}
            >
              <Input
                id="passenger_count"
                name="passenger_count"
                type="number"
                inputMode="numeric"
                min={0}
                max={5000}
                defaultValue={trip.passenger_count}
                aria-invalid={Boolean(state.fieldErrors?.passenger_count)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PlaceField
              label="Pickup"
              name="pickup_location"
              coordinates="pickup"
              address={trip.pickup_location}
              lat={trip.pickup_lat}
              lng={trip.pickup_lng}
              errors={state.fieldErrors?.pickup_location}
            />
            <PlaceField
              label="Destination"
              name="destination"
              coordinates="destination"
              address={trip.destination}
              lat={trip.destination_lat}
              lng={trip.destination_lng}
              errors={state.fieldErrors?.destination}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {RESERVATION_TIMES.map(({ key, label }) => (
              <Field
                key={key}
                label={label}
                htmlFor={key}
                required={key === "departure_at"}
                errors={state.fieldErrors?.[key]}
              >
                <Input
                  id={key}
                  name={key}
                  type="datetime-local"
                  defaultValue={local(trip[key])}
                  aria-invalid={Boolean(state.fieldErrors?.[key])}
                  required={key === "departure_at"}
                />
              </Field>
            ))}
          </div>

          <Field label="Notes" htmlFor="notes" errors={state.fieldErrors?.notes}>
            <Textarea id="notes" name="notes" defaultValue={trip.notes ?? ""} rows={3} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Save changes</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * An address with the same place suggestions as the itinerary, carried to the
 * action as hidden fields: the text, plus the point when a suggestion was
 * picked rather than typed. The dialog unmounts on close, so each opening
 * starts again from the saved address.
 */
function PlaceField({
  label,
  name,
  coordinates,
  address: savedAddress,
  lat,
  lng,
  errors,
}: {
  label: string;
  /** The text column: `pickup_location` or `destination`. */
  name: string;
  /** What the coordinate columns start with: `pickup` or `destination`. */
  coordinates: string;
  address: string;
  lat: number | null;
  lng: number | null;
  errors?: string[];
}) {
  const [address, setAddress] = useState(savedAddress);
  const [point, setPoint] = useState(() =>
    lat !== null && lng !== null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : null,
  );

  return (
    <Field label={label} htmlFor={name} required errors={errors}>
      <AddressField
        id={name}
        value={address}
        invalid={Boolean(errors)}
        onChange={(next, picked) => {
          setAddress(next);
          setPoint(picked);
        }}
      />
      <input type="hidden" name={name} value={address} />
      <input type="hidden" name={`${coordinates}_lat`} value={point?.lat ?? ""} />
      <input type="hidden" name={`${coordinates}_lng`} value={point?.lng ?? ""} />
    </Field>
  );
}
