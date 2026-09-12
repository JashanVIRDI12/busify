// Creates a pre-confirmed demo login and puts it in the existing organization.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = process.argv[2] ?? "demo@viabus.ca";
const PASSWORD = process.argv[3] ?? "ViaBusDemo2026!";
const ROLE = process.argv[4] ?? "OWNER";

// Already there from a previous run? Reuse it and just reset the password.
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const existing = list?.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());

let userId;
if (existing) {
  userId = existing.id;
  await admin.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
  });
  console.log("reused existing account");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    // Confirmed on creation: a demo login must not depend on an inbox, and no
    // mail provider is configured anyway.
    email_confirm: true,
    user_metadata: { full_name: "Via Bus Demo" },
  });
  if (error) {
    console.error("create failed:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("created account");
}

// The dedicated demo tenant, so this login never sees live operator data.
// Falls back to the only organization on a fresh install.
const DEMO_ORG = "Via Bus Demo";
let { data: orgs, error: orgError } = await admin
  .from("organizations")
  .select("id, name")
  .eq("name", DEMO_ORG)
  .limit(1);

if (!orgError && !orgs?.length) {
  ({ data: orgs, error: orgError } = await admin
    .from("organizations")
    .select("id, name")
    .order("created_at")
    .limit(1));
}

if (orgError || !orgs?.length) {
  console.error("no organization found:", orgError?.message);
  process.exit(1);
}

const org = orgs[0];

const { error: memberError } = await admin
  .from("organization_members")
  .upsert(
    { organization_id: org.id, user_id: userId, role: ROLE },
    { onConflict: "organization_id,user_id" },
  );

if (memberError) {
  console.error("membership failed:", memberError.message);
  process.exit(1);
}

// The profile row normally comes from the on_auth_user_created trigger, which
// only fires for brand-new auth rows.
await admin
  .from("profiles")
  .upsert({ id: userId, email: EMAIL, full_name: "Via Bus Demo" }, { onConflict: "id" });

console.log("");
console.log("  Organization :", org.name);
console.log("  Email        :", EMAIL);
console.log("  Password     :", PASSWORD);
console.log("  Role         :", ROLE);
