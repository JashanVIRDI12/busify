import {
  priceQuote,
  roundHalfUp,
  suggestLines,
  toMajor,
  toMinor,
  type QuoteLineInput,
} from "../lib/pricing/index.ts";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
}

// --- rounding -------------------------------------------------------------
check("half-up positive", roundHalfUp(0.5), 1);
check("half-up negative is symmetric", roundHalfUp(-0.5), -1);
check("round down", roundHalfUp(1.49), 1);
check("already integer", roundHalfUp(7), 7);

// --- unit conversion ------------------------------------------------------
check("toMinor from number", toMinor(58800), 5880000);
check("toMinor from numeric string", toMinor("45.50"), 4550);
check("toMinor rounds at the boundary", toMinor(0.005), 1);
check("toMajor", toMajor(5880000), 58800);
check("toMajor keeps two places", toMajor(4550), 45.5);
check("round trip", toMajor(toMinor("12345.67")), 12345.67);

// --- the worked example from the spec ------------------------------------
// 2 luxury coaches, Delhi–Jaipur return: base 12000 each, 560 km each way at
// 45/km, 18 driver-hours each at 850/h. 5% tax, no discount, 50% deposit.
const lines: QuoteLineInput[] = [
  { kind: "VEHICLE", description: "base", quantity: 2, unitPrice: toMinor(12000) },
  { kind: "MILEAGE", description: "km", quantity: 1120, unitPrice: toMinor(45) },
  { kind: "DRIVER", description: "hours", quantity: 36, unitPrice: toMinor(850) },
];

const quote = priceQuote({
  lines,
  discount: 0,
  taxRatePercent: 5,
  depositPercent: 50,
});

check("vehicle line", toMajor(quote.lines[0]!.amount), 24000);
check("mileage line", toMajor(quote.lines[1]!.amount), 50400);
check("driver line", toMajor(quote.lines[2]!.amount), 30600);
check("subtotal", toMajor(quote.subtotal), 105000);
check("tax at 5%", toMajor(quote.tax), 5250);
check("total", toMajor(quote.total), 110250);
check("deposit at 50%", toMajor(quote.deposit), 55125);
check("deposit + balance equals total", quote.deposit + quote.balance, quote.total);

// --- discount behaviour ---------------------------------------------------
const discounted = priceQuote({
  lines,
  discount: toMinor(5000),
  taxRatePercent: 5,
  depositPercent: 25,
});
check("discount reduces the taxable base", toMajor(discounted.taxable), 100000);
check("tax follows the discount", toMajor(discounted.tax), 5000);
check("discounted total", toMajor(discounted.total), 105000);

const overDiscounted = priceQuote({
  lines,
  discount: toMinor(999999),
  taxRatePercent: 5,
  depositPercent: 0,
});
check("discount cannot exceed subtotal", overDiscounted.discount, overDiscounted.subtotal);
check("total never goes negative", overDiscounted.total, 0);

// --- fractional quantities ------------------------------------------------
const fractional = priceQuote({
  lines: [
    { kind: "DRIVER", description: "2.5 h", quantity: 2.5, unitPrice: toMinor(850) },
  ],
  discount: 0,
  taxRatePercent: 0,
  depositPercent: 0,
});
check("fractional hours", toMajor(fractional.subtotal), 2125);

// A rate that would drift in floating point: 0.1 * 3 !== 0.3
const drift = priceQuote({
  lines: [
    { kind: "FUEL", description: "litres", quantity: 3, unitPrice: toMinor(0.1) },
  ],
  discount: 0,
  taxRatePercent: 0,
  depositPercent: 0,
});
check("no floating point drift", drift.subtotal, 30);

// --- clamps ---------------------------------------------------------------
const clamped = priceQuote({
  lines,
  discount: -500,
  taxRatePercent: -5,
  depositPercent: 250,
});
check("negative discount clamps to zero", clamped.discount, 0);
check("negative tax clamps to zero", clamped.tax, 0);
check("deposit above 100% clamps to total", clamped.deposit, clamped.total);
check("balance then zero", clamped.balance, 0);

const empty = priceQuote({ lines: [], discount: 0, taxRatePercent: 18, depositPercent: 50 });
check("empty quote totals zero", empty.total, 0);

// --- suggestions ----------------------------------------------------------
const suggested = suggestLines({
  vehicleType: {
    name: "Luxury Coach",
    base_rate: "12000.00",
    per_km_rate: "45.00",
    per_hour_rate: "850.00",
  },
  vehicleCount: 2,
  distanceKm: 560,
  durationHours: 18,
});
check("three suggested lines", suggested.length, 3);
check("mileage is per vehicle", suggested[1]!.quantity, 1120);
check("driver hours are per vehicle", suggested[2]!.quantity, 36);
check(
  "suggested total matches the worked example",
  toMajor(priceQuote({ lines: suggested, discount: 0, taxRatePercent: 5, depositPercent: 50 }).total),
  110250,
);

const zeroRates = suggestLines({
  vehicleType: { name: "Van", base_rate: 0, per_km_rate: 0, per_hour_rate: 0 },
  vehicleCount: 1,
  distanceKm: 100,
  durationHours: 4,
});
check("zero rates produce no lines", zeroRates.length, 0);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
