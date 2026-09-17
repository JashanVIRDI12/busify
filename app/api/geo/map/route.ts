import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/session";
import { geoProvider, type GeoPoint } from "@/lib/services/geo";

export const dynamic = "force-dynamic";

/**
 * `lng,lat;lng,lat` — the same shape the routing providers take, so the caller
 * never has to know which one is answering.
 */
const pathSchema = z
  .string()
  .trim()
  .min(3)
  .max(600)
  .transform((value, ctx): GeoPoint[] => {
    const points = value.split(";").map((pair) => {
      const [lng, lat] = pair.split(",").map(Number);
      return { lat: lat!, lng: lng! };
    });

    const valid = points.every(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        Math.abs(point.lat) <= 90 &&
        Math.abs(point.lng) <= 180,
    );

    // Capped as much to keep the overlay URL inside the provider's length limit
    // as to stop this being used as a general-purpose image proxy.
    if (!valid || points.length < 1 || points.length > 12) {
      ctx.addIssue({ code: "custom", message: "Bad path." });
      return z.NEVER;
    }

    return points;
  });

const sizeSchema = z.coerce.number().int().min(160).max(1280);

/**
 * An image of a reservation's route.
 *
 * A picture rather than an interactive map on purpose. A sold charter's route
 * does not move, so there is nothing to pan around, and a static image costs no
 * JavaScript, needs no browser token and renders the moment the page does.
 *
 * It is a proxy because the provider key is server-side only. Handing the
 * browser a URL with the key in it to save one hop would publish the key to
 * every viewer of the page.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = pathSchema.safeParse(params.get("path"));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad path." }, { status: 400 });
  }

  const width = sizeSchema.safeParse(params.get("w") ?? 640);
  const height = sizeSchema.safeParse(params.get("h") ?? 420);

  const provider = geoProvider();
  if (!provider.staticMapUrl) {
    return NextResponse.json(
      { error: "Maps are not configured." },
      { status: 501 },
    );
  }

  const points = parsed.data;
  // Two or more points can be joined by a road; a single pin is just a pin.
  const shape =
    points.length > 1 && provider.routeShape
      ? await provider.routeShape(points)
      : null;

  const url = provider.staticMapUrl(points, shape, {
    width: width.success ? width.data : 640,
    height: height.success ? height.data : 420,
  });

  if (!url) {
    return NextResponse.json(
      { error: "Maps are not configured." },
      { status: 501 },
    );
  }

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json({ error: "Map unavailable." }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      // A sold trip's route is fixed, so this is worth keeping for the length of
      // a working day. Private: the URL describes where a customer is going.
      "Cache-Control": "private, max-age=28800",
    },
  });
}
