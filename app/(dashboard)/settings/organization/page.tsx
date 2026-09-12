import { redirect } from "next/navigation";

/** The organization form is now the General tab of Settings. */
export default function OrganizationSettingsRedirect() {
  redirect("/settings");
}
