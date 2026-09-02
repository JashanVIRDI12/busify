import "server-only";

import { z } from "zod";

/**
 * A declared-but-blank variable (`OPENROUTER_API_KEY=` in .env.local) arrives
 * as an empty string, not undefined. Treat it as absent, otherwise every
 * placeholder line in the env file becomes a startup crash.
 */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );
}

/**
 * Server-side environment. Importing this module from a Client Component is a
 * build error thanks to `server-only`, which is the guarantee that keeps the
 * service-role and OpenRouter keys out of the browser bundle.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  NEXT_PUBLIC_SITE_URL: optional(z.url()),
  OPENROUTER_API_KEY: optional(z.string().min(1)),

  /** Slug of the single organization this deployment serves. */
  VIABUS_ORG_SLUG: optional(z.string().min(1)),
});

let cached: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (cached) return cached;

  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    VIABUS_ORG_SLUG: process.env.VIABUS_ORG_SLUG,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid or missing environment variables: ${missing}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Absolute origin, used to build auth email redirect URLs. */
export function siteUrl() {
  const env = serverEnv();
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
