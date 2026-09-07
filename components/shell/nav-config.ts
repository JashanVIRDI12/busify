import {
  BusFront,
  CalendarDays,
  Columns3,
  FileText,
  GanttChartSquare,
  Building2,
  Inbox,
  TicketCheck,
  LifeBuoy,
  Receipt,
  Users,
  UserSquare,
  type LucideIcon,
} from "lucide-react";

export type NavLeaf = {
  label: string;
  href: string;
  icon?: LucideIcon;
  description?: string;
};

export type NavEntry = {
  label: string;
  /** Present on a top-level destination; absent on a group. */
  href?: string;
  /** Present on a group; absent on a destination. */
  items?: NavLeaf[];
  badge?: string;
  /** Extra paths that should light this entry up, beyond its own children. */
  matches?: string[];
};

/**
 * The primary navigation is horizontal and shallow: six entries, of which three
 * open a menu. Everything an operator touches hourly (quotes, reservations) is
 * one click; everything they touch daily is two.
 */
export const NAV: NavEntry[] = [
  { label: "Quotes", href: "/quotes" },
  { label: "Reservations", href: "/reservations" },
  {
    label: "Dispatch",
    badge: "NEW",
    items: [
      {
        label: "Board",
        href: "/board",
        icon: Columns3,
        description: "Today's runs beside the vehicle and driver grid",
      },
      {
        label: "Calendar",
        href: "/dispatch",
        icon: CalendarDays,
        description: "Month and week view of every pickup",
      },
      {
        label: "Assignments",
        href: "/assignments",
        icon: GanttChartSquare,
        description: "Timeline of vehicle utilisation and conflicts",
      },
    ],
  },
  {
    label: "Contacts",
    items: [
      {
        label: "Contacts",
        href: "/contacts",
        icon: Users,
        description: "The people who book with you",
      },
      {
        label: "Companies",
        href: "/companies",
        icon: Building2,
        description: "Schools, agencies and corporates",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Vehicles",
        href: "/vehicles",
        icon: BusFront,
        description: "Fleet, capacity and amenities",
      },
      {
        label: "Drivers",
        href: "/drivers",
        icon: UserSquare,
        description: "Roster and contact details",
      },
      {
        label: "Driver Pay",
        href: "/driver-pay",
        icon: Receipt,
        description: "Per-reservation pay and pay stubs",
      },
      {
        label: "Tickets",
        href: "/tickets",
        icon: LifeBuoy,
        description: "Issues raised against a reservation",
      },
      // Inbound demand and confirmed bookings do not have their own entry in
      // the top bar — they live under Operations so the bar stays six wide.
      {
        label: "Trip Requests",
        href: "/trip-requests",
        icon: Inbox,
        description: "Enquiries from your public booking page",
      },
      {
        label: "Bookings",
        href: "/bookings",
        icon: TicketCheck,
        description: "Quotes the customer has accepted and paid",
      },
    ],
  },
  { label: "Reports", href: "/reports" },
];

/** Flattened lookup used by the mobile drawer and the command palette. */
export const NAV_LEAVES: NavLeaf[] = NAV.flatMap((entry) =>
  entry.items
    ? entry.items
    : entry.href
      ? [{ label: entry.label, href: entry.href, icon: FileText }]
      : [],
);

export function isEntryActive(entry: NavEntry, pathname: string): boolean {
  const candidates = [
    ...(entry.href ? [entry.href] : []),
    ...(entry.items?.map((item) => item.href) ?? []),
    ...(entry.matches ?? []),
  ];

  return candidates.some(
    (href) => pathname === href || pathname.startsWith(href + "/"),
  );
}
