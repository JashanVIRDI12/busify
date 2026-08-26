import {
  SALES_TAX,
  defaultTaxRate,
  describeTaxRate,
  formatGstNumber,
  isValidGstNumber,
  taxForOrigin,
} from "../lib/tax/canada.ts";
import { asProvinceCode, formatPostalCode, POSTAL_CODE_PATTERN, PROVINCES } from "../lib/constants.ts";
import { priceQuote, toMajor, toMinor } from "../lib/pricing/index.ts";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
}

// --- every province and territory is covered ------------------------------
check("13 provinces and territories", PROVINCES.length, 13);
check(
  "every province has a rate",
  PROVINCES.every((p) => typeof SALES_TAX[p.code].combined === "number"),
  true,
);
check(
  "federal component is 5% everywhere",
  Object.values(SALES_TAX).every((entry) => entry.gst === 5),
  true,
);
check(
  "combined always equals gst plus provincial",
  Object.values(SALES_TAX).every(
    (entry) => Math.abs(entry.combined - (entry.gst + entry.provincial)) < 1e-9,
  ),
  true,
);

// --- the rates themselves -------------------------------------------------
check("Ontario HST", SALES_TAX.ON.combined, 13);
check("Nova Scotia HST is 14 since April 2025", SALES_TAX.NS.combined, 14);
check("New Brunswick HST", SALES_TAX.NB.combined, 15);
check("Newfoundland HST", SALES_TAX.NL.combined, 15);
check("PEI HST", SALES_TAX.PE.combined, 15);
check("Quebec GST plus QST", SALES_TAX.QC.combined, 14.975);
check("Alberta GST only", SALES_TAX.AB.combined, 5);
check("BC charges GST only on passenger transport", SALES_TAX.BC.combined, 5);
check("Saskatchewan GST only", SALES_TAX.SK.combined, 5);
check("Manitoba GST only", SALES_TAX.MB.combined, 5);
check("Yukon GST only", SALES_TAX.YT.combined, 5);

// --- labels ---------------------------------------------------------------
check("Ontario is labelled HST", SALES_TAX.ON.label, "HST");
check("Alberta is labelled GST", SALES_TAX.AB.label, "GST");
check("Quebec names both taxes", SALES_TAX.QC.label, "GST + QST");

// --- place of supply ------------------------------------------------------
// The rate follows where the journey starts, not where the operator is based.
check("origin Ontario", taxForOrigin("ON")?.combined, 13);
check("origin lowercase is accepted", taxForOrigin("on")?.combined, 13);
check("origin with whitespace", taxForOrigin("  QC ")?.combined, 14.975);
check("unknown origin does not guess", taxForOrigin("XX"), null);
check("null origin does not guess", taxForOrigin(null), null);
check("US state is not a province", asProvinceCode("NY"), null);
check("unknown origin yields a zero prefill", defaultTaxRate(undefined), 0);

// --- describing a hand-typed rate ----------------------------------------
check("13 in Ontario is HST", describeTaxRate(13, "ON"), "HST");
check("5 anywhere is GST", describeTaxRate(5, "AB"), "GST");
check("5 typed in Ontario is still GST", describeTaxRate(5, "ON"), "GST");
check("0 is no tax", describeTaxRate(0, "ON"), "No tax");
check("14.975 resolves to Quebec", describeTaxRate(14.975, null), "GST + QST");
check("an off-table rate stays generic", describeTaxRate(7.5, "ON"), "Tax");

// --- tax actually applied to a quote --------------------------------------
// One 55-seat coach, Toronto → Niagara Falls return: $850 base, 260 km at
// $3.40, 9 driver-hours at $42. Ontario HST at 13%, 25% deposit.
const priced = priceQuote({
  lines: [
    { kind: "VEHICLE", description: "Coach", quantity: 1, unitPrice: toMinor(850) },
    { kind: "MILEAGE", description: "Distance", quantity: 260, unitPrice: toMinor(3.4) },
    { kind: "DRIVER", description: "Driver hours", quantity: 9, unitPrice: toMinor(42) },
  ],
  discount: 0,
  taxRatePercent: SALES_TAX.ON.combined,
  depositPercent: 25,
});
check("subtotal", toMajor(priced.subtotal), 2112);
check("Ontario HST on that subtotal", toMajor(priced.tax), 274.56);
check("total", toMajor(priced.total), 2386.56);
check("deposit is a quarter of the taxed total", toMajor(priced.deposit), 596.64);
check("balance closes the total", toMajor(priced.deposit + priced.balance), 2386.56);

// Quebec's 14.975% is the case a two-decimal rate box would round away.
const quebec = priceQuote({
  lines: [{ kind: "VEHICLE", description: "Coach", quantity: 1, unitPrice: toMinor(1000) }],
  discount: 0,
  taxRatePercent: SALES_TAX.QC.combined,
  depositPercent: 0,
});
check("Quebec tax on $1000", toMajor(quebec.tax), 149.75);
check("Quebec total", toMajor(quebec.total), 1149.75);

// --- GST/HST registration numbers ----------------------------------------
check("valid RT number", isValidGstNumber("123456789RT0001"), true);
check("spaced RT number", isValidGstNumber("123456789 RT 0001"), true);
check("lowercase is accepted", isValidGstNumber("123456789rt0001"), true);
check("too few digits", isValidGstNumber("12345678RT0001"), false);
check("payroll account is not a GST account", isValidGstNumber("123456789RP0001"), false);
check("formatting", formatGstNumber("123456789rt0001"), "123456789 RT 0001");

// --- postal codes ---------------------------------------------------------
check("Ottawa postal code", POSTAL_CODE_PATTERN.test("K1A 0B1"), true);
check("no space is fine", POSTAL_CODE_PATTERN.test("K1A0B1"), true);
check("D is never used in the first position", POSTAL_CODE_PATTERN.test("D1A 0B1"), false);
check("Z is never used in the first position", POSTAL_CODE_PATTERN.test("Z1A 0B1"), false);
check("US ZIP is rejected", POSTAL_CODE_PATTERN.test("90210"), false);
check("normalising adds the space", formatPostalCode("m5v2t6"), "M5V 2T6");

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
