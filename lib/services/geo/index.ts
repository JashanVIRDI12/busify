import "server-only";

/**
 * Geo service — geocoding and road-distance for the quote itinerary.
 *
 * The Pricing tab needs kilometres and drive time between stops. That is a
 * routing-provider job (Mapbox, Google, OSRM…), and this module is the seam
 * where one drops in: set `GEO_PROVIDER` and add a case to `resolveProvider`.
 *
 * Until then the `mock` provider is used. It does NOT invent road distances —
 * it geocodes nothing and returns straight-line estimates only when the caller
 * already has coordinates, so the honest default is that the operator types
 * each leg's distance in by hand and the builder sums them.
 */

export type GeoPoint = { lat: number; lng: number };

export type GeocodeResult = {
  lat: number;
  lng: number;
  /** Normalised, human-readable address the provider matched. */
  label: string;
};

export type RouteLeg = { miles: number; minutes: number };

export type RouteResult = {
  legs: RouteLeg[];
  totalMiles: number;
  totalMinutes: number;
};

export interface GeoProvider {
  readonly name: string;
  /** Whether this provider can turn a free-text address into coordinates. */
  readonly canGeocode: boolean;
  geocode(query: string): Promise<GeocodeResult | null>;
  /** Distance and time for a path through the given points, in order. */
  route(points: GeoPoint[]): Promise<RouteResult | null>;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const mockProvider: GeoProvider = {
  name: "mock",
  canGeocode: false,

  async geocode() {
    return null;
  },

  async route(points) {
    if (points.length < 2) {
      return { legs: [], totalMiles: 0, totalMinutes: 0 };
    }

    // A rough road factor over the straight line, and 65 km/h average — enough
    // for an estimate the operator confirms, never a figure to quote blind.
    const ROAD_FACTOR = 1.25;
    const AVG_KMH = 65;

    const legs: RouteLeg[] = [];
    for (let i = 1; i < points.length; i += 1) {
      const straight = haversineKm(points[i - 1]!, points[i]!);
      const km = Math.round(straight * ROAD_FACTOR * 100) / 100;
      const minutes = Math.round((km / AVG_KMH) * 60);
      legs.push({ miles: km, minutes });
    }

    return {
      legs,
      totalMiles: legs.reduce((sum, leg) => sum + leg.miles, 0),
      totalMinutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    };
  },
};

function resolveProvider(): GeoProvider {
  switch (process.env.GEO_PROVIDER) {
    // case "mapbox":
    //   return mapboxProvider;
    default:
      return mockProvider;
  }
}

export function geoProvider(): GeoProvider {
  return resolveProvider();
}

/** Whether address fields should offer "look up" — false with the mock. */
export function geoCanGeocode(): boolean {
  return resolveProvider().canGeocode;
}
