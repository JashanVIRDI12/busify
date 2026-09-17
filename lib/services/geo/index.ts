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
 *   GOOGLE_MAPS_API_KEY set -> google  (best coverage for Canadian addresses)
 *   MAPBOX_TOKEN set        -> mapbox  (autocomplete + real roads)
 *   otherwise               -> osm     (one-shot geocoding only, no typeahead)
 *   GEO_PROVIDER=mock       -> mock    (no network at all; tests and offline)
 *
 * The OSM public endpoints are free and need no account, which is what makes a
 * fresh install useful immediately. They are demo servers under a fair-use
 * policy — fine for an operator pricing a few dozen quotes a day, not for bulk
 * traffic. Setting a key switches everything over with no code change.
 */

export type GeoPoint = { lat: number; lng: number };

export type GeocodeResult = {
  lat: number;
  lng: number;
  /** Normalised, human-readable address the provider matched. */
  label: string;
};

/**
 * One row in the typeahead.
 *
 * `point` is null for providers that price autocomplete separately from
 * coordinates: Google returns predictions as opaque place ids and charges for
 * the lookup that turns one into a location. Resolving all six on every
 * keystroke would be both slow and expensive, so the coordinates are fetched
 * once, for the single row the operator actually picks.
 */
export type Suggestion = {
  label: string;
  /** The shorter leading part of the label, when the provider separates it. */
  primary?: string;
  /** City and region, shown under the primary line. */
  secondary?: string;
  point: GeoPoint | null;
  /** Opaque provider handle, passed back to `resolve` on selection. */
  placeId?: string;
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
  /** Whether this provider permits interactive typeahead requests. */
  readonly canSuggest: boolean;
  geocode(query: string): Promise<GeocodeResult | null>;
  /** Ranked address suggestions for a partial query. */
  suggest(
    query: string,
    limit?: number,
    signal?: AbortSignal,
    /** Groups a burst of keystrokes and the selection into one billed unit. */
    sessionToken?: string,
  ): Promise<Suggestion[]>;
  /**
   * Coordinates for a suggestion that arrived without them. Providers that
   * always return a point leave this undefined.
   */
  resolve?(
    placeId: string,
    sessionToken?: string,
  ): Promise<GeocodeResult | null>;
  /** Distance and time for a path through the given points, in order. */
  route(points: GeoPoint[]): Promise<RouteResult | null>;
  /**
   * The driven route as an encoded polyline, for drawing rather than measuring.
   * Undefined on providers that cannot draw.
   */
  routeShape?(points: GeoPoint[]): Promise<string | null>;
  /**
   * A ready-to-fetch image of the route.
   *
   * Returns a provider URL with the key already in it, so this must never reach
   * the browser — the route handler fetches it and streams back the bytes.
   */
  staticMapUrl?(
    points: GeoPoint[],
    shape: string | null,
    size: { width: number; height: number },
  ): string | null;
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
async function fetchJson<T>(
  url: string,
  {
    timeoutMs = 8000,
    signal,
    cacheable = true,
    method = "GET",
    headers,
    body,
  }: {
    timeoutMs?: number;
    signal?: AbortSignal;
    cacheable?: boolean;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        // The Nominatim usage policy requires an identifying User-Agent and
        // refuses requests that arrive without one.
        "User-Agent":
          "Busify/1.0 (charter operations; +https://github.com/busify)",
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...(cacheable
        ? {
            // OSM addresses and road distances change slowly, and the same
            // itinerary is often re-routed while an operator edits a stop.
            next: { revalidate: 60 * 60 * 24 },
          }
        : { cache: "no-store" as const }),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // A geo lookup failing must never break the quote — the operator can still
    // type the distance in by hand, which is what they did before this existed.
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function toLegs(raw: { distance: number; duration: number }[]): RouteResult {
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
/* Google: Places API (New) for addresses, Routes API for roads.               */
/* -------------------------------------------------------------------------- */

type GooglePrediction = {
  placePrediction?: {
    placeId: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

type GooglePlace = {
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
};

type GoogleRoute = {
  routes?: {
    legs?: { distanceMeters?: number; duration?: string }[];
  }[];
};

/** Routes API durations arrive as a protobuf duration string, e.g. "1234s". */
function parseDuration(value: string | undefined): number {
  return value ? Number.parseFloat(value.replace(/s$/, "")) || 0 : 0;
}

function googleProviderWith(key: string): GeoProvider {
  const provider: GeoProvider = {
    name: "google",
    canGeocode: true,
    canSuggest: true,

    async suggest(query, limit = 6, signal, sessionToken) {
      const trimmed = query.trim();
      if (trimmed.length < 3) return [];

      const body = await fetchJson<{ suggestions?: GooglePrediction[] }>(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          timeoutMs: 3000,
          signal,
          // Predictions are session-scoped and must not be reused.
          cacheable: false,
          headers: { "X-Goog-Api-Key": key },
          body: {
            input: trimmed,
            // Charter work here is Canadian, with cross-border runs south.
            includedRegionCodes: ["ca", "us"],
            languageCode: "en",
            ...(sessionToken ? { sessionToken } : {}),
          },
        },
      );

      const predictions = body?.suggestions ?? [];

      return predictions
        .map((entry) => entry.placePrediction)
        .filter((prediction) => Boolean(prediction?.placeId))
        .slice(0, limit)
        .map((prediction) => {
          const main = prediction!.structuredFormat?.mainText?.text;
          const secondary = prediction!.structuredFormat?.secondaryText?.text;

          return {
            label:
              prediction!.text?.text ??
              [main, secondary].filter(Boolean).join(", "),
            primary: main,
            secondary,
            // Google bills coordinates separately; fetched on selection only.
            point: null,
            placeId: prediction!.placeId,
          };
        });
    },

    async resolve(placeId, sessionToken) {
      const suffix = sessionToken
        ? `?sessionToken=${encodeURIComponent(sessionToken)}`
        : "";

      const place = await fetchJson<GooglePlace>(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${suffix}`,
        {
          timeoutMs: 4000,
          cacheable: false,
          headers: {
            "X-Goog-Api-Key": key,
            // Billed by field group, so ask for nothing beyond what is used.
            "X-Goog-FieldMask": "location,formattedAddress",
          },
        },
      );

      if (!place?.location) return null;

      return {
        lat: place.location.latitude,
        lng: place.location.longitude,
        label: place.formattedAddress ?? "",
      };
    },

    /**
     * One-shot free text to coordinates, for addresses the operator typed out
     * rather than picked. Text Search rather than Autocomplete: it answers with
     * a location directly, so this costs one call instead of two.
     */
    async geocode(query) {
      const trimmed = query.trim();
      if (trimmed.length < 3) return null;

      const body = await fetchJson<{ places?: GooglePlace[] }>(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          timeoutMs: 5000,
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.location,places.formattedAddress",
          },
          body: {
            textQuery: trimmed,
            includedRegionCodes: ["ca", "us"],
            languageCode: "en",
            maxResultCount: 1,
          },
        },
      );

      const place = body?.places?.[0];
      if (!place?.location) return null;

      return {
        lat: place.location.latitude,
        lng: place.location.longitude,
        label: place.formattedAddress ?? trimmed,
      };
    },

    async route(points) {
      if (points.length < 2) return { legs: [], totalMiles: 0, totalMinutes: 0 };

      const waypoint = (point: GeoPoint) => ({
        location: { latLng: { latitude: point.lat, longitude: point.lng } },
      });

      const body = await fetchJson<GoogleRoute>(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          timeoutMs: 8000,
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "routes.legs.distanceMeters,routes.legs.duration",
          },
          body: {
            origin: waypoint(points[0]!),
            destination: waypoint(points[points.length - 1]!),
            ...(points.length > 2
              ? { intermediates: points.slice(1, -1).map(waypoint) }
              : {}),
            travelMode: "DRIVE",
            // A coach is not a car, but Google has no bus profile. Leaving
            // traffic out keeps the same itinerary measuring the same way
            // whenever it is re-priced.
            routingPreference: "TRAFFIC_UNAWARE",
            units: "METRIC",
          },
        },
      );

      const legs = body?.routes?.[0]?.legs;
      if (!legs) return null;

      return toLegs(
        legs.map((leg) => ({
          distance: leg.distanceMeters ?? 0,
          duration: parseDuration(leg.duration),
        })),
      );
    },
  };

  return provider;
}

/* -------------------------------------------------------------------------- */
/* OpenStreetMap: Nominatim for addresses, OSRM for roads. No key required.    */
/* -------------------------------------------------------------------------- */

type NominatimHit = { lat: string; lon: string; display_name: string };

const osmProvider: GeoProvider = {
  name: "osm",
  canGeocode: true,
  // The public Nominatim usage policy explicitly forbids autocomplete. It is
  // retained for one-shot geocoding when the operator measures an itinerary.
  canSuggest: false,

  async geocode(query) {
    const results = await osmProvider.suggest(query, 1);
    const hit = results[0];
    return hit?.point
      ? { lat: hit.point.lat, lng: hit.point.lng, label: hit.label }
      : null;
  },

  async suggest(query, limit = 6, signal) {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?q=${encodeURIComponent(trimmed)}` +
      `&format=jsonv2&addressdetails=0&limit=${limit}` +
      // Charter work here is Canadian, with cross-border runs into the States.
      "&countrycodes=ca,us";

    const hits = await fetchJson<NominatimHit[]>(url, {
      timeoutMs: 4000,
      signal,
    });
    if (!hits) return [];

    return hits.map((hit) => ({
      label: hit.display_name,
      point: { lat: Number(hit.lat), lng: Number(hit.lon) },
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
/* Mapbox: used whenever a token is present and Google is not.                 */
/* -------------------------------------------------------------------------- */

type MapboxFeature = { center: [number, number]; place_name: string };

function mapboxProviderWith(token: string): GeoProvider {
  const provider: GeoProvider = {
    name: "mapbox",
    canGeocode: true,
    canSuggest: true,

    async geocode(query) {
      const results = await provider.suggest(query, 1);
      const hit = results[0];
      return hit?.point
        ? { lat: hit.point.lat, lng: hit.point.lng, label: hit.label }
        : null;
    },

    async suggest(query, limit = 6, signal) {
      const trimmed = query.trim();
      if (trimmed.length < 3) return [];

      const url =
        "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
        `${encodeURIComponent(trimmed)}.json` +
        `?access_token=${encodeURIComponent(token)}` +
        `&limit=${limit}&country=ca,us&types=address,poi,place`;

      const body = await fetchJson<{ features: MapboxFeature[] }>(url, {
        timeoutMs: 3000,
        signal,
        // Temporary Mapbox geocoding responses must not be cached.
        cacheable: false,
      });
      if (!body?.features) return [];

      return body.features.map((feature) => ({
        label: feature.place_name,
        point: { lat: feature.center[1], lng: feature.center[0] },
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

    /**
     * The same request as `route`, asking for the shape instead of the numbers.
     *
     * Kept separate because measuring happens on every keystroke in the builder
     * and full geometry is a much larger response — the itinerary never needs
     * it, and only the map ever asks.
     */
    async routeShape(points) {
      if (points.length < 2) return null;

      const path = points.map((point) => `${point.lng},${point.lat}`).join(";");
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${path}` +
        `?access_token=${encodeURIComponent(token)}` +
        "&overview=full&geometries=polyline";

      const body = await fetchJson<{
        code: string;
        routes: { geometry: string }[];
      }>(url);

      return body?.code === "Ok" ? (body.routes[0]?.geometry ?? null) : null;
    },

    staticMapUrl(points, shape, size) {
      if (points.length === 0) return null;

      const overlays: string[] = [];

      // The driven line goes down first so the pins sit on top of it.
      if (shape) {
        overlays.push(`path-4+0d8b7c-0.85(${encodeURIComponent(shape)})`);
      }

      // Mapbox numbers a pin from its label, and only for a single character,
      // so past nine the stop is drawn as a plain dot rather than a wrong number.
      points.forEach((point, index) => {
        const label = index < 9 ? `-${index + 1}` : "";
        overlays.push(`pin-s${label}+12a594(${point.lng},${point.lat})`);
      });

      // `auto` frames the overlays, with padding so a pin never sits on the edge.
      return (
        "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/" +
        `${overlays.join(",")}/auto/${size.width}x${size.height}@2x` +
        `?access_token=${encodeURIComponent(token)}&padding=48`
      );
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
  canSuggest: false,

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

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) return googleProviderWith(googleKey);

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
