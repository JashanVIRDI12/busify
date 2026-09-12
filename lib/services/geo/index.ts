import "server-only";

/**
 * Geo service — address lookup and road distance for the quote itinerary.
 *
 * The Pricing tab needs kilometres and drive time between stops, and the
 * itinerary needs to turn what an operator types into a real address. Both are
 * routing-provider jobs, and this module is the seam where one drops in.
 *
 * The provider is chosen by capability rather than configuration, so the
 * product works out of the box and gets better when a key is added:
 *
 *   MAPBOX_TOKEN set  -> mapbox   (production: proper autocomplete, real roads)
 *   otherwise         -> osm      (Nominatim + OSRM public servers, no key)
 *   GEO_PROVIDER=mock -> mock     (no network at all; tests and offline work)
 *
 * The OSM public endpoints are free and need no account, which is what makes a
 * fresh install useful immediately. They are demo servers under a fair-use
 * policy — fine for an operator pricing a few dozen quotes a day, not for bulk
 * traffic. Setting MAPBOX_TOKEN switches everything over with no code change.
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
  /** Whether this provider can turn free text into coordinates. */
  readonly canGeocode: boolean;
  geocode(query: string): Promise<GeocodeResult | null>;
  /** Ranked address suggestions for a partial query. */
  suggest(query: string, limit?: number): Promise<GeocodeResult[]>;
  /** Distance and time for a path through the given points, in order. */
  route(points: GeoPoint[]): Promise<RouteResult | null>;
}

const EARTH_RADIUS_KM = 6371;
const METRES_PER_KM = 1000;

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

/** One network call, with a ceiling so a slow provider cannot hang a save. */
async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // The Nominatim usage policy requires an identifying User-Agent and
        // refuses requests that arrive without one.
        "User-Agent":
          "Busify/1.0 (charter operations; +https://github.com/busify)",
        Accept: "application/json",
      },
      // Addresses and road distances change on the order of months, and the
      // same itinerary gets re-routed every time the operator edits a stop.
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // A geo lookup failing must never break the quote — the operator can still
    // type the distance in by hand, which is what they did before this existed.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toLegs(
  raw: { distance: number; duration: number }[],
): RouteResult {
  const legs = raw.map((leg) => ({
    miles: Math.round((leg.distance / METRES_PER_KM) * 100) / 100,
    minutes: Math.round(leg.duration / 60),
  }));

  return {
    legs,
    totalMiles:
      Math.round(legs.reduce((sum, leg) => sum + leg.miles, 0) * 100) / 100,
    totalMinutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
  };
}

type OsrmResponse = {
  code: string;
  routes: { legs: { distance: number; duration: number }[] }[];
};

/* -------------------------------------------------------------------------- */
/* OpenStreetMap: Nominatim for addresses, OSRM for roads. No key required.    */
/* -------------------------------------------------------------------------- */

type NominatimHit = { lat: string; lon: string; display_name: string };

const osmProvider: GeoProvider = {
  name: "osm",
  canGeocode: true,

  async geocode(query) {
    const results = await osmProvider.suggest(query, 1);
    return results[0] ?? null;
  },

  async suggest(query, limit = 6) {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?q=${encodeURIComponent(trimmed)}` +
      `&format=jsonv2&addressdetails=0&limit=${limit}` +
      // Charter work here is Canadian, with cross-border runs into the States.
      "&countrycodes=ca,us";

    const hits = await fetchJson<NominatimHit[]>(url);
    if (!hits) return [];

    return hits.map((hit) => ({
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name,
    }));
  },

  async route(points) {
    if (points.length < 2) return { legs: [], totalMiles: 0, totalMinutes: 0 };

    const path = points.map((point) => `${point.lng},${point.lat}`).join(";");
    const url =
      `https://router.project-osrm.org/route/v1/driving/${path}` +
      "?overview=false&annotations=false&steps=false";

    const body = await fetchJson<OsrmResponse>(url);
    const route = body?.code === "Ok" ? body.routes[0] : undefined;
    return route ? toLegs(route.legs) : null;
  },
};

/* -------------------------------------------------------------------------- */
/* Mapbox: used whenever a token is present.                                   */
/* -------------------------------------------------------------------------- */

type MapboxFeature = { center: [number, number]; place_name: string };

function mapboxProviderWith(token: string): GeoProvider {
  const provider: GeoProvider = {
    name: "mapbox",
    canGeocode: true,

    async geocode(query) {
      const results = await provider.suggest(query, 1);
      return results[0] ?? null;
    },

    async suggest(query, limit = 6) {
      const trimmed = query.trim();
      if (trimmed.length < 3) return [];

      const url =
        "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
        `${encodeURIComponent(trimmed)}.json` +
        `?access_token=${encodeURIComponent(token)}` +
        `&limit=${limit}&country=ca,us&types=address,poi,place`;

      const body = await fetchJson<{ features: MapboxFeature[] }>(url);
      if (!body?.features) return [];

      return body.features.map((feature) => ({
        lat: feature.center[1],
        lng: feature.center[0],
        label: feature.place_name,
      }));
    },

    async route(points) {
      if (points.length < 2) return { legs: [], totalMiles: 0, totalMinutes: 0 };

      const path = points.map((point) => `${point.lng},${point.lat}`).join(";");
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${path}` +
        `?access_token=${encodeURIComponent(token)}&overview=false`;

      const body = await fetchJson<OsrmResponse>(url);
      const route = body?.code === "Ok" ? body.routes[0] : undefined;
      return route ? toLegs(route.legs) : null;
    },
  };

  return provider;
}

/* -------------------------------------------------------------------------- */
/* Mock: no network. Straight lines only, and it never pretends otherwise.     */
/* -------------------------------------------------------------------------- */

const mockProvider: GeoProvider = {
  name: "mock",
  canGeocode: false,

  async geocode() {
    return null;
  },

  async suggest() {
    return [];
  },

  async route(points) {
    if (points.length < 2) return { legs: [], totalMiles: 0, totalMinutes: 0 };

    // A rough road factor over the straight line, and 65 km/h average — enough
    // for an estimate the operator confirms, never a figure to quote blind.
    const ROAD_FACTOR = 1.25;
    const AVG_KMH = 65;

    const legs: RouteLeg[] = [];
    for (let i = 1; i < points.length; i += 1) {
      const straight = haversineKm(points[i - 1]!, points[i]!);
      const km = Math.round(straight * ROAD_FACTOR * 100) / 100;
      legs.push({ miles: km, minutes: Math.round((km / AVG_KMH) * 60) });
    }

    return {
      legs,
      totalMiles:
        Math.round(legs.reduce((sum, leg) => sum + leg.miles, 0) * 100) / 100,
      totalMinutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    };
  },
};

function resolveProvider(): GeoProvider {
  if (process.env.GEO_PROVIDER === "mock") return mockProvider;

  const token = process.env.MAPBOX_TOKEN;
  if (token) return mapboxProviderWith(token);

  return osmProvider;
}

export function geoProvider(): GeoProvider {
  return resolveProvider();
}

/** Whether address fields should offer look-up — false only with the mock. */
export function geoCanGeocode(): boolean {
  return resolveProvider().canGeocode;
}
