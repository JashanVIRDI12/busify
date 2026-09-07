import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";

/**
 * The customer's copy of a quote, as a PDF.
 *
 * Built with pdf-lib rather than by rendering HTML in a headless browser: this
 * runs in a serverless function, where launching Chromium costs seconds and
 * hundreds of megabytes to produce two pages of text. The trade is that layout
 * is manual, which is why everything below flows through one cursor and one
 * `wrap()` helper rather than being positioned absolutely.
 */

export type QuotePdfLine = { label: string; detail?: string | null; amount?: string | null };

export type QuotePdfTrip = {
  name: string;
  stops: { label: string; address: string | null; when: string | null }[];
  lines: QuotePdfLine[];
  total: string;
};

export type QuotePdfData = {
  organization: {
    name: string;
    addressLines: string[];
    email: string | null;
    phone: string | null;
    taxNumber: string | null;
    brandColor: string | null;
    logo: { bytes: Uint8Array; type: "png" | "jpg" } | null;
  };
  quote: {
    reference: string;
    title: string;
    createdOn: string;
    validUntil: string | null;
    notes: string | null;
    terms: string | null;
  };
  contact: {
    name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  trips: QuotePdfTrip[];
  totals: { label: string; amount: string; strong?: boolean }[];
};

const PAGE = { width: 612, height: 792 };
const MARGIN = 48;
const INK = rgb(0.11, 0.11, 0.12);
const SLATE = rgb(0.37, 0.39, 0.42);
const HAIRLINE = rgb(0.86, 0.87, 0.88);

export async function renderQuotePdf(data: QuotePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${data.quote.reference} — ${data.organization.name}`);
  doc.setProducer("Busify");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = parseHex(data.organization.brandColor) ?? rgb(0.976, 0.482, 0.255);

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  /** Moves to a new page when the next block would not fit. */
  function ensure(space: number) {
    if (y - space > MARGIN) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  }

  function text(
    value: string,
    options: {
      size?: number;
      font?: PDFFont;
      color?: RGB;
      x?: number;
      maxWidth?: number;
      lineGap?: number;
    } = {},
  ) {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const x = options.x ?? MARGIN;
    const maxWidth = options.maxWidth ?? PAGE.width - MARGIN * 2 - (x - MARGIN);

    for (const line of wrap(value, font, size, maxWidth)) {
      ensure(size + 4);
      page.drawText(line, { x, y, size, font, color: options.color ?? INK });
      y -= size + (options.lineGap ?? 3);
    }
  }

  /** Right-aligned, for money. */
  function amount(value: string, options: { size?: number; font?: PDFFont; at?: number } = {}) {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const right = options.at ?? PAGE.width - MARGIN;
    page.drawText(value, {
      x: right - font.widthOfTextAtSize(value, size),
      y,
      size,
      font,
      color: INK,
    });
  }

  function rule(gap = 10) {
    ensure(gap + 2);
    y -= gap;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 0.75,
      color: HAIRLINE,
    });
    y -= gap;
  }

  // --- Letterhead ----------------------------------------------------------
  page.drawRectangle({
    x: 0,
    y: PAGE.height - 6,
    width: PAGE.width,
    height: 6,
    color: brand,
  });

  const headerTop = y;

  if (data.organization.logo) {
    try {
      const image =
        data.organization.logo.type === "png"
          ? await doc.embedPng(data.organization.logo.bytes)
          : await doc.embedJpg(data.organization.logo.bytes);
      const scaled = image.scaleToFit(150, 44);
      page.drawImage(image, {
        x: MARGIN,
        y: headerTop - scaled.height + 8,
        width: scaled.width,
        height: scaled.height,
      });
      y -= scaled.height + 6;
    } catch {
      // A logo that will not decode is not worth failing a quote over.
      text(data.organization.name, { size: 16, font: bold });
    }
  } else {
    text(data.organization.name, { size: 16, font: bold });
  }

  // Quote identity, right-hand column of the letterhead.
  const idSize = 9;
  const idLines = [
    ["Quote", data.quote.reference],
    ["Date", data.quote.createdOn],
    ...(data.quote.validUntil ? [["Valid until", data.quote.validUntil]] : []),
  ];

  let idY = headerTop;
  for (const [label, value] of idLines) {
    const labelText = `${label}  `;
    const valueWidth = bold.widthOfTextAtSize(value!, idSize);
    const labelWidth = regular.widthOfTextAtSize(labelText, idSize);
    page.drawText(labelText, {
      x: PAGE.width - MARGIN - valueWidth - labelWidth,
      y: idY,
      size: idSize,
      font: regular,
      color: SLATE,
    });
    page.drawText(value!, {
      x: PAGE.width - MARGIN - valueWidth,
      y: idY,
      size: idSize,
      font: bold,
      color: INK,
    });
    idY -= idSize + 4;
  }

  y = Math.min(y, idY) - 6;

  for (const line of data.organization.addressLines) {
    text(line, { size: 9, color: SLATE, lineGap: 1 });
  }
  const contactBits = [data.organization.phone, data.organization.email].filter(
    Boolean,
  );
  if (contactBits.length) text(contactBits.join("  ·  "), { size: 9, color: SLATE });
  if (data.organization.taxNumber) {
    text(data.organization.taxNumber, { size: 9, color: SLATE });
  }

  rule(14);

  // --- Prepared for --------------------------------------------------------
  text("PREPARED FOR", { size: 8, font: bold, color: SLATE });
  y -= 2;
  if (data.contact.company) text(data.contact.company, { size: 11, font: bold });
  if (data.contact.name) text(data.contact.name, { size: 10 });
  const who = [data.contact.email, data.contact.phone].filter(Boolean);
  if (who.length) text(who.join("  ·  "), { size: 9, color: SLATE });

  if (data.quote.title && data.quote.title !== "New Quote") {
    y -= 4;
    text(data.quote.title, { size: 11, font: bold });
  }

  // --- Trips ---------------------------------------------------------------
  for (const trip of data.trips) {
    rule(14);
    ensure(60);

    text(trip.name, { size: 12, font: bold });
    y -= 4;

    for (const [index, stop] of trip.stops.entries()) {
      ensure(28);
      const marker = `${index + 1}.`;
      page.drawText(marker, {
        x: MARGIN,
        y,
        size: 9,
        font: bold,
        color: brand,
      });

      const label = stop.label || stop.address || "Stop";
      page.drawText(truncate(label, bold, 10, 300), {
        x: MARGIN + 18,
        y,
        size: 10,
        font: bold,
        color: INK,
      });

      if (stop.when) {
        page.drawText(stop.when, {
          x: PAGE.width - MARGIN - regular.widthOfTextAtSize(stop.when, 9),
          y,
          size: 9,
          font: regular,
          color: SLATE,
        });
      }
      y -= 13;

      if (stop.address && stop.address !== label) {
        text(stop.address, { size: 9, color: SLATE, x: MARGIN + 18, maxWidth: 330 });
      }
      y -= 3;
    }

    if (trip.lines.length > 0) {
      y -= 6;
      for (const line of trip.lines) {
        ensure(16);
        page.drawText(truncate(line.label, regular, 10, 340), {
          x: MARGIN + 18,
          y,
          size: 10,
          font: regular,
          color: INK,
        });
        if (line.amount) amount(line.amount);
        y -= 13;

        if (line.detail) {
          text(line.detail, { size: 8.5, color: SLATE, x: MARGIN + 18, maxWidth: 330 });
        }
      }
    }

    ensure(20);
    y -= 4;
    page.drawText(`${trip.name} total`, {
      x: MARGIN + 18,
      y,
      size: 10,
      font: bold,
      color: INK,
    });
    amount(trip.total, { font: bold });
    y -= 16;
  }

  // --- Totals --------------------------------------------------------------
  rule(12);
  for (const total of data.totals) {
    ensure(18);
    const font = total.strong ? bold : regular;
    const size = total.strong ? 12 : 10;
    page.drawText(total.label, {
      x: PAGE.width - MARGIN - 220,
      y,
      size,
      font,
      color: total.strong ? INK : SLATE,
    });
    amount(total.amount, { font, size });
    y -= size + 6;
  }

  // --- Notes and terms -----------------------------------------------------
  if (data.quote.notes) {
    rule(12);
    text("NOTES", { size: 8, font: bold, color: SLATE });
    y -= 2;
    text(data.quote.notes, { size: 9.5, color: SLATE, lineGap: 2 });
  }

  if (data.quote.terms) {
    rule(12);
    text("TERMS", { size: 8, font: bold, color: SLATE });
    y -= 2;
    text(data.quote.terms, { size: 8.5, color: SLATE, lineGap: 2 });
  }

  return doc.save();
}

/**
 * Greedy word wrap against the font's real metrics.
 *
 * A word longer than the line — a pasted URL, usually — is broken by character
 * rather than allowed to run off the page.
 */
function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of value.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);

      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }

      let chunk = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      current = chunk;
    }

    if (current) lines.push(current);
  }

  return lines;
}

function truncate(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;

  let result = value;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/** `#F97B41` → pdf-lib rgb. Anything unparseable falls back to the default. */
function parseHex(hex: string | null): RGB | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}

/** pdf-lib hands back a Uint8Array; mail providers want base64. */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
