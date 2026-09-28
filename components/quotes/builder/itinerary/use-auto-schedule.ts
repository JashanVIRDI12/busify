"use client";

import { useEffect, useRef } from "react";

import {
  addDaysToDate,
  clockDayShift,
  daysBetweenDates,
  formatClockTime,
  parseClockTime,
} from "@/lib/datetime";
import type {
  QuoteStopInput,
  QuoteTripInput,
} from "@/lib/validations/quote-builder";

import { useBuilder } from "../builder-context";

/**
 * How long before departure the coach is expected to be standing at the kerb.
 * Fifteen minutes is the charter convention — enough to load without keeping
 * the group waiting, and what operators mean when they quote a "spot time".
 */
export const SPOT_LEAD_MINUTES = 15;

/**
 * Canadian hours-of-service ceilings for a single work day. Past either line a
 * driver must take eight consecutive hours off, so the trip needs a second one.
 */
const HOS_DRIVE_HOURS = 13;
const HOS_DUTY_HOURS = 14;

/** Stable names for the values this hook owns, shared with the rows. */
export const autoKey = {
  spot: (stopId: string) => `${stopId}:spot`,
  arrive: (stopId: string) => `${stopId}:arrive`,
  arriveDate: (stopId: string) => `${stopId}:arrive_date`,
  departingTime: "trip:departing_time",
  departingDate: "trip:departing_date",
  returningTime: "trip:returning_time",
  returningDate: "trip:returning_date",
  hours: "trip:hours",
  days: "trip:days",
  drivers: "trip:drivers",
} as const;

export type AutoSchedule = {
  /** Whether a displayed value is this hook's output rather than typed input. */
  isAuto: (key: string, value: string | null | undefined) => boolean;
};

/**
 * Days after the anchor's date that a typed clock time falls on: the first
 * time the clock reads it at or after the coach could be there. 01:30 after a
 * 23:00 dropoff is the next morning, not the evening before.
 */
function dayOfTypedTime(own: number, earliest: number | null): number {
  if (earliest === null) return 0;
  const days = clockDayShift(earliest);
  return days + (own < earliest - days * 1440 ? 1 : 0);
}

/**
 * Fills in the times the itinerary already implies.
 *
 * An operator who has given two addresses and a departure time has said
 * everything needed to know when the coach arrives — the router has already
 * measured the drive. Making them add it up by hand, across midnight, for every
 * stop, is asking them to do arithmetic the page is holding all the inputs for.
 *
 * Two rules keep it from becoming a nuisance:
 *
 * 1. It only fills a blank, or revises a value it wrote itself. Anything the
 *    operator types is theirs for good — a coach that must be somewhere by ten
 *    is a fact no drive-time estimate gets to overrule.
 * 2. A time the operator sets re-anchors everything after it, so an afternoon
 *    spent at stop two pushes stop three out without anyone re-deriving a chain.
 */
export function useAutoSchedule(trip: QuoteTripInput): AutoSchedule {
  const { setStop, setTrip, canEdit } = useBuilder();

  // What this hook last wrote, which is how it tells its own output from the
  // operator's input. A value that is blank, or still exactly what was written
  // here, may be revised; anything else has been taken over and is left alone.
  const written = useRef(new Map<string, string>());

  // Only the fields the schedule is derived from. Leg distances are in here
  // because a re-measured route should move the arrival times with it.
  const fingerprint = JSON.stringify([
    canEdit,
    trip.departing_garage_id,
    trip.returning_garage_id,
    trip.departing_time,
    trip.departing_date,
    trip.returning_time,
    trip.returning_date,
    trip.return_leg_minutes,
    trip.hours,
    trip.days,
    trip.driver_count,
    trip.stops.map((stop) => [
      stop.id,
      stop.stop_time,
      stop.stop_date,
      stop.spot_time,
      stop.leg_minutes,
      stop.dwell_minutes,
    ]),
  ]);

  useEffect(() => {
    if (!canEdit) return;

    const mine = written.current;
    /** Blank, or untouched since this hook last set it. */
    const mayWrite = (key: string, current: string | null | undefined) =>
      !current || mine.get(key) === current;
    /** The same test for the numeric fields, where zero is the blank. */
    const mayWriteNumber = (key: string, current: number) =>
      !current || mine.get(key) === String(current);

    const first = trip.stops[0];
    if (!first) return;

    const departMinutes = parseClockTime(first.stop_time);
    const spotMinutes =
      departMinutes === null ? null : departMinutes - SPOT_LEAD_MINUTES;

    // Spot time, which the yard departure below is in turn backed off from.
    if (spotMinutes !== null) {
      const spotKey = autoKey.spot(first.id);

      if (mayWrite(spotKey, first.spot_time)) {
        const spot = formatClockTime(spotMinutes);
        if (spot !== first.spot_time) {
          mine.set(spotKey, spot);
          setStop(trip.id, first.id, { spot_time: spot });
        }
      }
    }

    /*
     * Dates are owned separately from times, so a day the operator picked is
     * never overwritten by one that came with an estimated time, and a blank
     * day can follow the pickup's before any time is known. A same-day
     * charter is the common case: pick the pickup's date and every later row
     * lands on it, moved on only where the clock actually crosses midnight.
     */

    // Leaving the yard: back off the dead leg from the kerb-side arrival, so
    // the garage row says when the driver actually has to pull out.
    if (trip.departing_garage_id) {
      const deadLeg = Math.round(first.leg_minutes || 0);
      const timeIsOurs = mayWrite(autoKey.departingTime, trip.departing_time);
      const leave =
        spotMinutes !== null && deadLeg > 0 ? spotMinutes - deadLeg : null;
      const patch: Partial<QuoteTripInput> = {};

      if (leave !== null && timeIsOurs) {
        const leaveTime = formatClockTime(leave);
        if (leaveTime !== trip.departing_time) {
          mine.set(autoKey.departingTime, leaveTime);
          patch.departing_time = leaveTime;
        }
      }

      const leaveDate = addDaysToDate(
        first.stop_date,
        leave !== null && timeIsOurs ? clockDayShift(leave) : 0,
      );
      if (
        leaveDate &&
        leaveDate !== trip.departing_date &&
        mayWrite(autoKey.departingDate, trip.departing_date)
      ) {
        mine.set(autoKey.departingDate, leaveDate);
        patch.departing_date = leaveDate;
      }

      if (Object.keys(patch).length > 0) setTrip(trip.id, patch);
    }

    // Walk the stops, carrying a running clock forward through the legs.
    let anchorMinutes = departMinutes;
    let anchorDate = first.stop_date ?? null;

    for (let index = 1; index < trip.stops.length; index += 1) {
      const stop = trip.stops[index]!;
      const timeKey = autoKey.arrive(stop.id);
      const dateKey = autoKey.arriveDate(stop.id);
      const own = parseClockTime(stop.stop_time);
      const leg = Math.round(stop.leg_minutes || 0);
      // Standing time here delays everything downstream, not this arrival.
      const dwell = Math.round(stop.dwell_minutes || 0);
      const patch: Partial<QuoteStopInput> = {};
      let date: string | null;

      if (own !== null && !mayWrite(timeKey, stop.stop_time)) {
        // A time the operator set outranks the estimate and restarts the chain.
        const earliest = anchorMinutes === null ? null : anchorMinutes + leg;
        date = addDaysToDate(anchorDate, dayOfTypedTime(own, earliest));
        anchorMinutes = own + dwell;
      } else if (anchorMinutes !== null && leg > 0) {
        const arrival = anchorMinutes + leg;
        const arriveTime = formatClockTime(arrival);
        if (arriveTime !== stop.stop_time) {
          mine.set(timeKey, arriveTime);
          patch.stop_time = arriveTime;
        }
        date = addDaysToDate(anchorDate, clockDayShift(arrival));
        // Carry the clock, not the running total. `arrival` may be past 1440
        // and `date` has already absorbed those days — keeping the raw figure
        // would charge the same midnight to every stop that follows.
        anchorMinutes = (parseClockTime(arriveTime) ?? 0) + dwell;
      } else {
        // Nothing to count from, or the route has not been measured yet. The
        // day still follows the one before it.
        date = anchorDate;
      }

      const dateIsOurs = mayWrite(dateKey, stop.stop_date);
      if (date && date !== stop.stop_date && dateIsOurs) {
        mine.set(dateKey, date);
        patch.stop_date = date;
      }
      if (Object.keys(patch).length > 0) setStop(trip.id, stop.id, patch);

      anchorDate = (dateIsOurs ? date : stop.stop_date) ?? anchorDate;
    }

    // Back to the yard: the last stop plus the return dead leg.
    if (trip.returning_garage_id) {
      const returnLeg = Math.round(trip.return_leg_minutes || 0);
      const timeIsOurs = mayWrite(autoKey.returningTime, trip.returning_time);
      const earliest =
        anchorMinutes !== null && returnLeg > 0 ? anchorMinutes + returnLeg : null;
      const typed = timeIsOurs ? null : parseClockTime(trip.returning_time);
      const patch: Partial<QuoteTripInput> = {};

      if (earliest !== null && timeIsOurs) {
        const backTime = formatClockTime(earliest);
        if (backTime !== trip.returning_time) {
          mine.set(autoKey.returningTime, backTime);
          patch.returning_time = backTime;
        }
      }

      const backDate = addDaysToDate(
        anchorDate,
        typed !== null
          ? dayOfTypedTime(typed, earliest)
          : earliest !== null
            ? clockDayShift(earliest)
            : 0,
      );
      if (
        backDate &&
        backDate !== trip.returning_date &&
        mayWrite(autoKey.returningDate, trip.returning_date)
      ) {
        mine.set(autoKey.returningDate, backDate);
        patch.returning_date = backDate;
      }

      if (Object.keys(patch).length > 0) setTrip(trip.id, patch);
    }

    /**
     * Duty hours and calendar days — the two figures the Pricing tab used to
     * ask for outright.
     *
     * Duty is the whole window the coach and driver are committed for: the
     * spot lead, every driving leg including the dead runs to and from the
     * yard, and every minute spent standing at a stop. That is what an hourly
     * charter actually bills, and quoting drive time alone is how a wedding —
     * one hour of driving, six hours at the venue — gets quoted at a sixth of
     * what it costs to run.
     */
    const driveMinutes =
      trip.stops.reduce((sum, stop) => sum + (stop.leg_minutes || 0), 0) +
      (trip.return_leg_minutes || 0);
    const dwellMinutes = trip.stops.reduce(
      (sum, stop) => sum + (stop.dwell_minutes || 0),
      0,
    );

    if (driveMinutes > 0) {
      const duty = SPOT_LEAD_MINUTES + driveMinutes + dwellMinutes;

      const hours = Math.round((duty / 60) * 100) / 100;
      if (mayWriteNumber(autoKey.hours, trip.hours) && hours !== trip.hours) {
        mine.set(autoKey.hours, String(hours));
        setTrip(trip.id, { hours });
      }

      // A daily rate bills calendar days, not 24-hour blocks: a Friday evening
      // to Sunday morning run is three days on the invoice. Fall back to the
      // duration only while the dates are still blank.
      const lastDate =
        trip.returning_date ??
        trip.stops[trip.stops.length - 1]?.stop_date ??
        null;
      const span = daysBetweenDates(first.stop_date, lastDate);
      const days =
        span === null
          ? Math.max(1, Math.ceil(duty / 1440))
          : Math.max(1, span + 1);

      if (mayWriteNumber(autoKey.days, trip.days) && days !== trip.days) {
        mine.set(autoKey.days, String(days));
        setTrip(trip.id, { days });
      }

      /**
       * How many drivers the law requires.
       *
       * A Canadian driver may spend 13 hours driving and 14 on duty in a work
       * day before taking eight consecutive hours off. Past either line the
       * trip needs a second driver, and an operator who works that out on the
       * morning of the charter pays for it out of the margin.
       *
       * Measured per day rather than across the whole trip: a three-day tour
       * with six hours of driving each day is one driver's work, and totalling
       * it would demand a crew nobody needs.
       */
      const dutyPerDay = duty / days / 60;
      const drivePerDay = driveMinutes / days / 60;
      const crew = Math.max(
        1,
        Math.ceil(dutyPerDay / HOS_DUTY_HOURS),
        Math.ceil(drivePerDay / HOS_DRIVE_HOURS),
      );

      if (
        mayWriteNumber(autoKey.drivers, trip.driver_count ?? 0) &&
        crew !== trip.driver_count
      ) {
        mine.set(autoKey.drivers, String(crew));
        setTrip(trip.id, { driver_count: crew });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  return {
    // Read from the ref rather than state on purpose. This only decides whether
    // a field wears an "auto" tag, and the effect above has already written the
    // entry by the time its own setStop re-renders the row. Mirroring it into
    // state would double every render of the itinerary to move a 9px label.
    isAuto: (key, value) => Boolean(value) && written.current.get(key) === value,
  };
}
