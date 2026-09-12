import { redirect } from "next/navigation";

/** Renamed to Integrations, which is what the settings rail calls it. */
export default function ApiSettingsRedirect() {
  redirect("/settings/integrations");
}
