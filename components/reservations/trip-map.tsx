import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

export type MapPoint = { lat: number; lng: number; label?: string };

/**
 * The reservation's route, drawn.
 *
 * An image rather than an interactive map. A sold charter's route does not
 * change, so there is nothing to pan around; a picture costs no JavaScript, no
 * browser-side map key and no second render pass, and it is on screen the
 * moment the page is.
 *
 * The provider key never reaches here — the `src` points at this application,
 * which fetches the image server-side and streams it back.
 */
export function TripMap({
  points,
  className,
  width = 640,
  height = 420,
}: {
  points: MapPoint[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const placed = points.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );

  if (placed.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-bone bg-mist/50 p-8 text-center",
          className,
        )}
      >
        <MapPin className="size-5 text-ash" aria-hidden="true" />
        <p className="text-body-sm font-medium text-ink">No route to draw</p>
        <p className="max-w-[38ch] text-[12px] text-slate">
          This reservation&apos;s addresses were typed rather than picked from
          the suggestions, so it has no coordinates. Pick the addresses on the
          quote and convert again to place it on a map.
        </p>
      </div>
    );
  }

  const path = placed.map((point) => `${point.lng},${point.lat}`).join(";");
  const src = `/api/geo/map?path=${encodeURIComponent(path)}&w=${width}&h=${height}`;

  const described = placed
    .map((point, index) => point.label ?? `Stop ${index + 1}`)
    .join(", then ");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-bone bg-mist",
        className,
      )}
    >
      {/*
        A plain <img>: the source is already sized and cached by the route
        handler, and running it through the image optimiser would put a second
        fetch of the same bytes in front of every render.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={width}
        height={height}
        alt={`Map of the route: ${described}.`}
        loading="lazy"
        className="h-auto w-full"
      />
    </div>
  );
}
