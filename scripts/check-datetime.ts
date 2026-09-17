import {
  zonedTimeToUtc,
  utcToZonedInputValue,
  relativeDays,
  tripWindow,
  parseClockTime,
  formatClockTime,
  clockDayShift,
  addDaysToDate,
  daysBetweenDates,
} from "../lib/datetime.ts";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
}

check(
  "IST 06:00 -> UTC",
  zonedTimeToUtc("2026-09-20T06:00", "Asia/Kolkata"),
  "2026-09-20T00:30:00.000Z",
);
check(
  "UTC passthrough",
  zonedTimeToUtc("2026-09-20T06:00", "UTC"),
  "2026-09-20T06:00:00.000Z",
);
check(
  "NY summer (EDT, -4)",
  zonedTimeToUtc("2026-07-01T12:00", "America/New_York"),
  "2026-07-01T16:00:00.000Z",
);
check(
  "NY winter (EST, -5)",
  zonedTimeToUtc("2026-01-15T12:00", "America/New_York"),
  "2026-01-15T17:00:00.000Z",
);
check(
  "IST midnight (hour-24 edge)",
  zonedTimeToUtc("2026-09-20T00:00", "Asia/Kolkata"),
  "2026-09-19T18:30:00.000Z",
);
// 2026-03-08: clocks jump 02:00 EST -> 03:00 EDT. 03:30 is already EDT (-4).
check(
  "NY just after spring forward",
  zonedTimeToUtc("2026-03-08T03:30", "America/New_York"),
  "2026-03-08T07:30:00.000Z",
);
// 01:30 the same morning is still EST (-5).
check(
  "NY just before spring forward",
  zonedTimeToUtc("2026-03-08T01:30", "America/New_York"),
  "2026-03-08T06:30:00.000Z",
);
// 2026-11-01: clocks fall back 02:00 EDT -> 01:00 EST. 01:30 is ambiguous;
// resolving it to the first (EDT) occurrence is the conventional choice.
check(
  "NY ambiguous hour on fall back",
  zonedTimeToUtc("2026-11-01T01:30", "America/New_York"),
  "2026-11-01T05:30:00.000Z",
);
// 02:30 on spring-forward morning never happens. It must not throw.
const nonexistent = zonedTimeToUtc("2026-03-08T02:30", "America/New_York");
check("NY nonexistent local time does not throw", typeof nonexistent, "string");
check("invalid input", zonedTimeToUtc("not a date", "UTC"), null);

// --- Canadian zones -------------------------------------------------------
// Newfoundland is UTC-3:30 in winter and -2:30 in summer. A half-hour offset
// breaks anything that assumes whole hours, and it is the only zone in the
// product where that assumption fails.
check(
  "Newfoundland winter is -3:30",
  zonedTimeToUtc("2026-01-15T09:00", "America/St_Johns"),
  "2026-01-15T12:30:00.000Z",
);
check(
  "Newfoundland summer is -2:30",
  zonedTimeToUtc("2026-07-15T09:00", "America/St_Johns"),
  "2026-07-15T11:30:00.000Z",
);

// Saskatchewan never changes its clocks. 08:00 in Regina is 14:00Z in January
// and 14:00Z in July; a dispatcher who assumes it tracks Winnipeg is an hour
// out for seven months of the year.
check(
  "Regina winter is -6",
  zonedTimeToUtc("2026-01-15T08:00", "America/Regina"),
  "2026-01-15T14:00:00.000Z",
);
check(
  "Regina does not spring forward",
  zonedTimeToUtc("2026-07-15T08:00", "America/Regina"),
  "2026-07-15T14:00:00.000Z",
);

// Yukon has been on year-round MST since 2020 - it no longer follows Vancouver.
check(
  "Whitehorse holds -7 in winter",
  zonedTimeToUtc("2026-01-15T08:00", "America/Whitehorse"),
  "2026-01-15T15:00:00.000Z",
);
check(
  "Whitehorse holds -7 in summer",
  zonedTimeToUtc("2026-07-15T08:00", "America/Whitehorse"),
  "2026-07-15T15:00:00.000Z",
);

// Canada springs forward on the second Sunday in March, same as the US.
check(
  "Toronto just before spring forward",
  zonedTimeToUtc("2026-03-08T01:30", "America/Toronto"),
  "2026-03-08T06:30:00.000Z",
);
check(
  "Toronto just after spring forward",
  zonedTimeToUtc("2026-03-08T03:30", "America/Toronto"),
  "2026-03-08T07:30:00.000Z",
);

// A coast-to-coast charter: 4.5 hours separate St. Johns from Vancouver.
check(
  "Vancouver to St. Johns spread in hours",
  (Date.parse(zonedTimeToUtc("2026-07-15T08:00", "America/Vancouver")!) -
    Date.parse(zonedTimeToUtc("2026-07-15T08:00", "America/St_Johns")!)) /
    3_600_000,
  4.5,
);

for (const [value, zone] of [
  ["2026-09-20T06:00", "Asia/Kolkata"],
  ["2026-07-01T12:00", "America/New_York"],
  ["2026-01-15T23:45", "America/New_York"],
  ["2026-12-31T00:00", "Australia/Sydney"],
  ["2026-07-15T14:20", "America/Toronto"],
  ["2026-02-02T07:05", "America/St_Johns"],
  ["2026-06-30T23:59", "America/Regina"],
  ["2026-11-11T00:00", "America/Vancouver"],
  ["2026-08-01T12:00", "America/Whitehorse"],
] as const) {
  const utc = zonedTimeToUtc(value, zone);
  check(`round trip ${zone} ${value}`, utcToZonedInputValue(utc!, zone), value);
}

const w = tripWindow("2026-09-20T00:30:00.000Z", null);
check("one-way window is 24h", w.end.getTime() - w.start.getTime(), 86_400_000);

const now = new Date("2026-09-20T10:00:00Z");
check("relative today", relativeDays("2026-09-20T18:00:00Z", "UTC", now), "today");
check("relative tomorrow", relativeDays("2026-09-21T02:00:00Z", "UTC", now), "tomorrow");
// 22:00 on the 20th in Toronto is still today there, whatever UTC says.
check(
  "relative uses the operator's calendar",
  relativeDays("2026-09-21T02:00:00Z", "America/Toronto", now),
  "today",
);
// An 8 p.m. Toronto departure two days back is past midnight in UTC; a
// server-clock count would call it "yesterday".
check(
  "relative evening departure two days ago",
  relativeDays("2026-09-10T00:00:00Z", "America/Toronto", new Date("2026-09-11T15:00:00Z")),
  "2 days ago",
);



// ---------------------------------------------------------------------------
// Itinerary clock arithmetic. These drive the auto-filled arrival and spot
// times, so every case that crosses midnight is one a real overnight charter
// would hit.
// ---------------------------------------------------------------------------

check("parse a time", parseClockTime("18:30"), 1110);
check("parse midnight", parseClockTime("00:00"), 0);
check("parse with seconds", parseClockTime("07:05:00"), 425);
check("blank is not a time", parseClockTime(""), null);
check("null is not a time", parseClockTime(null), null);
check("hour 25 is rejected", parseClockTime("25:00"), null);
check("minute 60 is rejected", parseClockTime("12:60"), null);

check("format a time", formatClockTime(1110), "18:30");
check("format pads", formatClockTime(425), "07:05");
check("past midnight wraps", formatClockTime(1500), "01:00");
check("before midnight wraps back", formatClockTime(-5), "23:55");

check("same day", clockDayShift(600), 0);
check("over midnight is next day", clockDayShift(1500), 1);
check("under midnight is previous day", clockDayShift(-5), -1);
check("two days out", clockDayShift(2900), 2);

check("add a day", addDaysToDate("2026-09-20", 1), "2026-09-21");
check("no shift returns the date", addDaysToDate("2026-09-20", 0), "2026-09-20");
check("cross new year", addDaysToDate("2026-12-31", 1), "2027-01-01");
check("back over a month", addDaysToDate("2026-03-01", -1), "2026-02-28");
check("leap year", addDaysToDate("2028-03-01", -1), "2028-02-29");
check("no date, no shift", addDaysToDate(null, 1), null);

// An 11:30 p.m. departure with a four-hour run lands at 03:30 the next morning.
const overnightDepart = parseClockTime("23:30");
const overnightArrive = (overnightDepart ?? 0) + 240;
check("overnight arrival time", formatClockTime(overnightArrive), "03:30");
check(
  "overnight arrival date",
  addDaysToDate("2026-09-20", clockDayShift(overnightArrive)),
  "2026-09-21",
);

// A 00:10 departure spots at 23:55 the evening before.
const earlyDepart = parseClockTime("00:10");
const spot = (earlyDepart ?? 0) - 15;
check("spot time before midnight", formatClockTime(spot), "23:55");
check(
  "spot date is the day before",
  addDaysToDate("2026-09-20", clockDayShift(spot)),
  "2026-09-19",
);


check("same day is zero", daysBetweenDates("2026-09-20", "2026-09-20"), 0);
check("two day span", daysBetweenDates("2026-09-20", "2026-09-22"), 2);
check("span over a month end", daysBetweenDates("2026-01-30", "2026-02-02"), 3);
check("span over a leap day", daysBetweenDates("2028-02-28", "2028-03-01"), 2);
check("backwards is negative", daysBetweenDates("2026-09-22", "2026-09-20"), -2);
check("missing date is unknown", daysBetweenDates(null, "2026-09-20"), null);
check("garbage is unknown", daysBetweenDates("nope", "2026-09-20"), null);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
