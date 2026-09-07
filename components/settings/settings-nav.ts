export type SettingsLink = { label: string; href: string };
export type SettingsGroup = { label: string; items: SettingsLink[] };

/**
 * The settings rail.
 *
 * Ordered the way an operator sets a company up, not alphabetically: the
 * company itself, then what it charges, then who works there, then the smaller
 * reference data that only matters once the first three are done.
 */
export const SETTINGS_NAV: SettingsGroup[] = [
  {
    label: "My Company",
    items: [
      { label: "General", href: "/settings" },
      { label: "Vehicle Rates", href: "/settings/rates" },
      { label: "Users", href: "/settings/users" },
      { label: "Custom Charges", href: "/settings/charges" },
      { label: "Garages", href: "/settings/garages" },
      { label: "Saved Stops", href: "/settings/saved-stops" },
      { label: "Driver Pay", href: "/settings/driver-pay" },
      { label: "Industries", href: "/settings/industries" },
      { label: "Templates", href: "/settings/templates" },
      { label: "Integrations", href: "/settings/integrations" },
    ],
  },
  {
    label: "My Profile",
    items: [{ label: "Profile", href: "/settings/profile" }],
  },
];
