import { redirect } from "next/navigation";

/** Garages moved under Settings, where the rest of the reference data lives. */
export default function GaragesRedirect() {
  redirect("/settings/garages");
}
