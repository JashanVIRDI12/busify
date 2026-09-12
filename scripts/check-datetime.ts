import {
  zonedTimeToUtc,
  utcToZonedInputValue,
  relativeDays,
  tripWindow,
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

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
