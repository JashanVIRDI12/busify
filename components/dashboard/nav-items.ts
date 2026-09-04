import {
  BarChart3,
  BusFront,
  CalendarDays,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  Route,
  BookOpen,
  Code2,
  Settings,
  TicketCheck,
  Users,
  UsersRound,
  UserSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Phase 2+ destinations are listed so the shell reflects the real product,
   *  but they are not linkable until the module exists. */
  comingSoon?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Trip Requests", href: "/trip-requests", icon: Inbox },
      { label: "Trips", href: "/trips", icon: Route },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, comingSoon: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Quotes", href: "/quotes", icon: FileText },
      { label: "Bookings", href: "/bookings", icon: TicketCheck },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Fleet", href: "/vehicles", icon: BusFront },
      { label: "Drivers", href: "/drivers", icon: UserSquare },
    ],
  },
  {
    label: "Insight",
    items: [
      { label: "Payments", href: "/payments", icon: CreditCard, comingSoon: true },
      { label: "Analytics", href: "/analytics", icon: BarChart3, comingSoon: true },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Guide", href: "/guide", icon: BookOpen },
      { label: "Team", href: "/settings/organization", icon: UsersRound },
      { label: "API", href: "/settings/api", icon: Code2 },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
