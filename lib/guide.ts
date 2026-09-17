import {
  BusFront,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Inbox,
  LifeBuoy,
  MapPin,
  Palette,
  Receipt,
  Route,
  Settings2,
  TicketCheck,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The How It Works handbook.
 *
 * Content lives here rather than in the page so the contents list and the
 * sections it links to cannot drift apart — both are rendered from this one
 * array, and a section that is added without a heading, or linked without
 * existing, is impossible rather than merely unlikely.
 *
 * Everything below describes what the product actually does today. A handbook
 * that documents an intention is worse than no handbook: it sends an operator
 * looking for a screen that is not there, and they stop trusting the rest of
 * it. Anything unbuilt is named as unbuilt, in its own section.
 */

export type GuideStep = {
  title: string;
  body: string;
};

export type GuideSection = {
  /** Anchor target. Also the value used by the contents list. */
  id: string;
  title: string;
  icon: LucideIcon;
  /** One or two sentences, shown under the heading. */
  summary: string;
  steps: GuideStep[];
  /** Screens this section is about. */
  links?: { href: string; label: string }[];
  /** Things that bite. Shown as a highlighted aside. */
  notes?: string[];
  /** Set when the feature is not built, which changes how it renders. */
  unbuilt?: boolean;
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "setup",
    title: "First-time setup",
    icon: ClipboardList,
    summary:
      "Four things decide whether everything else works. Do them once, in this order, before quoting anything real.",
    steps: [
      {
        title: "1. Add a garage",
        body: "Settings → Garages. A garage is where your coaches sleep. Dead kilometres — the empty running to the first pickup and back from the last drop — are measured from it, and without one every quote under-counts what the trip costs you to run.",
      },
      {
        title: "2. Set a default garage",
        body: "Settings → General. Once set, every new quote starts with it already chosen at both ends. Skip this and the garage row says 'No garage' on every quote and somebody has to pick it each time.",
      },
      {
        title: "3. Create your vehicle types",
        body: "Vehicles → Types. A type is a class of coach — 56-seat highway coach, 24-seat minibus — with its seating capacity. Quotes price from the type, not from an individual bus.",
      },
      {
        title: "4. Enter your rates",
        body: "Settings → Vehicle rates. Hourly, daily and per-kilometre for each type. A quote takes the highest of the three, which is how charter pricing works: an eight-hour job close to home bills hourly, a long one-way bills mileage.",
      },
      {
        title: "5. Check your tax setup",
        body: "Settings → General. The province decides the rate, and the rate follows where the journey starts, not where your office is. A Halifax operator picking up in Ottawa charges Ontario HST at 13%, not Nova Scotia's 14%.",
      },
    ],
    links: [
      { href: "/settings/garages", label: "Garages" },
      { href: "/vehicles/types", label: "Vehicle types" },
      { href: "/settings/rates", label: "Vehicle rates" },
      { href: "/settings/organization", label: "Organization" },
    ],
  },
  {
    id: "requests",
    title: "Where work comes from",
    icon: Inbox,
    summary:
      "Three ways a job reaches you. All three land in the same place, so nothing depends on which one a customer chose.",
    steps: [
      {
        title: "Your public booking link",
        body: "Settings → Integrations gives you a link and an embeddable button. Someone fills it in and the request arrives with their contact details already attached — no retyping, no transcription errors.",
      },
      {
        title: "Log it yourself",
        body: "Trip requests → New request. This is the fast path when the phone rings, which is still how most charter work is sold.",
      },
      {
        title: "Ask the assistant",
        body: "Describe the job in plain English and it prepares the request for you to confirm. Useful for a long email you would otherwise re-key.",
      },
    ],
    links: [
      { href: "/trip-requests", label: "Trip requests" },
      { href: "/settings/integrations", label: "Booking link" },
    ],
  },
  {
    id: "quotes",
    title: "Building a quote",
    icon: FileText,
    summary:
      "The quote builder is four tabs: Customer, Trip, Payment, Notes. A quote holds one or more trips, and each trip is priced on its own.",
    steps: [
      {
        title: "Nothing is saved until you save it",
        body: "Clicking 'Add quote' does not create anything. The builder opens on a blank model and the first save is what creates the quote and draws its number, so a stray click never leaves an empty Lead in your pipeline.",
      },
      {
        title: "Customer first",
        body: "Search an existing contact or create one inline. A company can be attached too, which is what puts the invoice in the company's name rather than the individual's.",
      },
      {
        title: "One tab per trip",
        body: "Use 'Add Trip' for a job with separate legs that price differently — an outbound on Friday and a return on Sunday, say. Each trip tab has its own itinerary, pricing and totals; the quote total is their sum.",
      },
      {
        title: "Quote status vs pipeline status",
        body: "Status is where the paperwork is (Draft, Sent, Accepted). Pipeline is where the sale is (Lead, Won, Lost). They move together when a customer accepts, and separately when you are working the deal by phone.",
      },
    ],
    links: [
      { href: "/quotes", label: "Quotes" },
      { href: "/quotes/new", label: "New quote" },
    ],
  },
  {
    id: "itinerary",
    title: "The itinerary, and what it works out for you",
    icon: MapPin,
    summary:
      "This is the part that saves the most typing. Give it two addresses and a departure time and it fills in almost everything else.",
    steps: [
      {
        title: "Type an address, pick a suggestion",
        body: "Picking one attaches coordinates, which is what lets the trip measure itself. You can ignore every suggestion and write 'back gate, loading dock 3' — the trip still works, it just has to look the address up again each time it measures.",
      },
      {
        title: "Distance and drive time measure themselves",
        body: "There is no calculate button. Once two addresses have settled, the route is measured against a real road network and each leg shows its own distance and time, with the running total beside it.",
      },
      {
        title: "Times cascade from the pickup",
        body: "Set the pickup departure time and the rest follows: spot time 15 minutes before, arrival at every later stop, the date rolling over on an overnight run, when the driver leaves the yard, and when the coach is back. Anything marked AUTO was worked out; type over it and it is yours, with a ↺ to hand it back.",
      },
      {
        title: "Wait time is the one thing you must tell it",
        body: "'Add Wait Time' on a stop. No system can guess how long a wedding runs. It matters more than it looks: a job with one hour of driving and six hours standing at a venue is a seven-hour charter, and pricing it on drive time alone quotes it at a sixth of its cost.",
      },
      {
        title: "Pickup and Dropoff are decided by position",
        body: "The first stop is the pickup because it is first. Drag a stop to the top and it becomes the pickup. That is why those labels are locked rather than typed.",
      },
      {
        title: "Drivers are counted for you",
        body: "Canadian hours-of-service allows 13 hours driving and 14 on duty in a work day. Past either line the trip needs a second driver, and the builder works that out per day — so a three-day tour at six hours a day stays one driver.",
      },
    ],
    links: [{ href: "/settings/saved-stops", label: "Saved stops" }],
    notes: [
      "Address suggestions need a maps key. Without one you can still type full addresses and the trip still measures — you just do not get the dropdown.",
      "Dead kilometres are the legs to and from the garage. They are in the total but not in live kilometres, which is the distance the passengers actually travelled.",
    ],
  },
  {
    id: "pricing",
    title: "Pricing and charges",
    icon: Receipt,
    summary:
      "Base fare, then charges, then tax. Every figure is calculated the same way in your browser and on the server, so the number you watch while typing is the number that is saved.",
    steps: [
      {
        title: "Base fare takes the highest",
        body: "Daily, hourly, mileage and flat are all worked out, and the largest wins. That is the charter convention: you quote the greater of your hourly minimum and the mileage rate. Switch to 'Choose' to force a particular one.",
      },
      {
        title: "Days, hours and distance come from the itinerary",
        body: "Hours is duty time — driving plus waiting plus the spot lead — not just drive time. Days is calendar days, so a Friday evening to Sunday morning job is three. Type over either to price a trip differently.",
      },
      {
        title: "Add charges from your saved list",
        body: "'Add charge' opens the list you keep in Settings → Charges, with the rate already right. Fuel surcharge, tolls, driver accommodation, cross-border fee. Picking one copies it onto the quote, so changing the rate in Settings next spring will not silently reprice a quote you sent last autumn.",
      },
      {
        title: "Or write a manual charge",
        body: "'Manual charge…' at the bottom of the same menu gives you an empty line: type the description and the amount. For the ferry crossing, the stadium permit, or a discount agreed on the phone.",
      },
      {
        title: "Base fare charges vs itemised charges",
        body: "A base fare charge is folded into the fare before tax and shows as part of it. An itemised charge is listed separately on the quote and can be marked non-taxable. Use itemised for anything the customer should see broken out.",
      },
      {
        title: "Override the total if you must",
        body: "The Total Base Fare box accepts a typed figure that replaces the calculation entirely, with a ↺ to go back. Use it for a price you have already promised.",
      },
      {
        title: "Tax is worked out from the province",
        body: "GST or HST at the correct provincial rate, applied once to the taxable subtotal. Passenger transportation inside Canada is taxable, not zero-rated. BC, Manitoba and Saskatchewan charge GST only — their provincial taxes do not apply to it.",
      },
    ],
    links: [
      { href: "/settings/charges", label: "Custom charges" },
      { href: "/settings/rates", label: "Vehicle rates" },
    ],
    notes: [
      "'Customer visibility' on the right controls how much of this the customer sees: every calculation, line totals only, or one total.",
    ],
  },
  {
    id: "sending",
    title: "Sending a quote",
    icon: Route,
    summary:
      "A quote reaches the customer as a link to a page addressed by a token, not by a login. They never need an account.",
    steps: [
      {
        title: "Email it, or copy the link",
        body: "Actions → Send emails it through your mail provider. Actions → Copy link gives you the same URL to paste into a message you write yourself.",
      },
      {
        title: "Download a PDF",
        body: "Actions → Download PDF for the customers and brokers who still want an attachment.",
      },
      {
        title: "They accept online",
        body: "Accepting marks the quote Accepted and Won, and creates the reservations in the same step. You do not have to convert it yourself.",
      },
    ],
    links: [{ href: "/settings/templates", label: "Contract terms" }],
  },
  {
    id: "reservations",
    title: "Reservations",
    icon: TicketCheck,
    summary:
      "A reservation is a sold job. It is what the board, the assignment timeline and driver pay all read.",
    steps: [
      {
        title: "One reservation per trip tab",
        body: "A quote with two trips becomes two reservations, numbered as siblings — 10009, 10009-2 — so they stay recognisably one booking.",
      },
      {
        title: "Converting is safe to repeat",
        body: "A quote that already has reservations returns them untouched. Accepting twice, or converting a quote the customer also accepted online, cannot double-book a coach.",
      },
      {
        title: "Convert by hand for phone bookings",
        body: "Actions → Convert to reservations. Plenty of charter work is agreed verbally, and you should not have to fake a customer acceptance to get a job onto the board.",
      },
      {
        title: "Every trip needs a date",
        body: "Conversion refuses a trip with no pickup date rather than guessing today's. If it complains, the itinerary is missing a date.",
      },
    ],
    links: [
      { href: "/reservations", label: "Reservations" },
      { href: "/bookings", label: "Bookings" },
    ],
  },
  {
    id: "dispatch",
    title: "Dispatch and assignments",
    icon: BusFront,
    summary:
      "Putting a coach and a driver against each sold job, then moving it through its operational states.",
    steps: [
      {
        title: "The board",
        body: "Everything sold, by day. Unassigned work is what you are looking for here.",
      },
      {
        title: "Assignments",
        body: "A timeline of who and what is committed when. Assigning a vehicle already out on another job is what this screen exists to prevent.",
      },
      {
        title: "Assignment status moves itself",
        body: "A reservation goes Unassigned → Partial → Assigned as you crew it, and back again if you remove someone. You never set it by hand.",
      },
      {
        title: "Status through the day",
        body: "Scheduled, confirmed, dispatched, under way, completed. Completing releases the vehicle back to the available pool.",
      },
    ],
    links: [
      { href: "/board", label: "Board" },
      { href: "/assignments", label: "Assignments" },
      { href: "/dispatch", label: "Dispatch" },
    ],
  },
  {
    id: "contacts",
    title: "Contacts and companies",
    icon: Users,
    summary:
      "A contact is a person. A company is who pays. A contact can belong to a company, and quotes can be addressed to either.",
    steps: [
      {
        title: "Contacts",
        body: "Everyone you deal with, with their quote and booking history on the record.",
      },
      {
        title: "Companies",
        body: "Schools, tour operators, corporates. Attach a company to a quote and the invoice goes to the company while the day-to-day contact stays the person.",
      },
    ],
    links: [
      { href: "/contacts", label: "Contacts" },
      { href: "/companies", label: "Companies" },
    ],
  },
  {
    id: "fleet",
    title: "Fleet",
    icon: Truck,
    summary:
      "Types carry the rates and the seating. Individual vehicles carry the registration and the availability.",
    steps: [
      {
        title: "Types before vehicles",
        body: "Create the type first — quotes price from it. A vehicle without a type cannot be priced.",
      },
      {
        title: "Per-vehicle rate overrides",
        body: "Settings → Vehicle rates. A specific coach can carry its own rate that beats its type's, for the newer bus you charge more for.",
      },
      {
        title: "Garages",
        body: "More than one is fine. Dead kilometres are measured from whichever the trip names.",
      },
    ],
    links: [
      { href: "/vehicles", label: "Vehicles" },
      { href: "/vehicles/types", label: "Types" },
      { href: "/garages", label: "Garages" },
    ],
  },
  {
    id: "drivers",
    title: "Drivers and driver pay",
    icon: ShieldCheck,
    summary:
      "Drivers are people who can be assigned. Driver pay turns completed work into what you owe them.",
    steps: [
      {
        title: "Drivers",
        body: "A driver can be linked to a user account, which is what lets them sign in and see their own work.",
      },
      {
        title: "Pay rules",
        body: "Settings → Driver pay. Hourly, per-kilometre, per-day, or a flat trip rate.",
      },
      {
        title: "Pay runs",
        body: "Driver pay builds from completed assignments, so it follows what actually ran rather than what was planned.",
      },
    ],
    links: [
      { href: "/drivers", label: "Drivers" },
      { href: "/driver-pay", label: "Driver pay" },
      { href: "/settings/driver-pay", label: "Pay rules" },
    ],
  },
  {
    id: "payments",
    title: "Payments and invoices",
    icon: Wallet,
    summary:
      "Deposits and balances are tracked against each booking, and invoices are generated as PDFs you can email.",
    steps: [
      {
        title: "Deposit and balance",
        body: "Set on the quote as a percentage or a fixed amount. The balance closes the total.",
      },
      {
        title: "Recording a payment",
        body: "Payments → Record. Payment status follows the amounts, so a part-payment shows as part-paid rather than as either extreme.",
      },
      {
        title: "Invoices",
        body: "Generated as a PDF and emailed from the Payments screen.",
      },
    ],
    links: [{ href: "/payments", label: "Payments" }],
    notes: [
      "Card collection is not built. Payments are recorded as having happened elsewhere — bank transfer, cheque, a card machine.",
    ],
  },
  {
    id: "reports",
    title: "Reports",
    icon: CreditCard,
    summary: "What was sold, what ran, and what is owed.",
    steps: [
      {
        title: "Read it by period",
        body: "Revenue, trip counts and outstanding balances over a date range.",
      },
    ],
    links: [{ href: "/reports", label: "Reports" }],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings2,
    summary: "Everything that decides how the rest of the product behaves.",
    steps: [
      {
        title: "Organization",
        body: "Name, province, currency, time zone, GST/HST number. The province sets your tax rate and the time zone decides what a trip time means.",
      },
      {
        title: "Charges",
        body: "The reusable list the quote builder offers. Mark one 'default on quote' and every new quote starts with it.",
      },
      {
        title: "Templates",
        body: "Contract terms attached to quotes. One can be the default.",
      },
      {
        title: "Users",
        body: "Who can sign in, and as what.",
      },
    ],
    links: [
      { href: "/settings/organization", label: "Organization" },
      { href: "/settings/charges", label: "Charges" },
      { href: "/settings/templates", label: "Templates" },
      { href: "/settings/users", label: "Users" },
    ],
  },
  {
    id: "statuses",
    title: "Status colours, and what they mean",
    icon: Palette,
    summary:
      "The same five colours are used everywhere, so a colour means the same thing on the board as it does on a vehicle list. Every pill also carries its word, because colour alone is unreadable to a lot of people and unprintable in black and white.",
    steps: [
      {
        title: "Green — good to go",
        body: "Finished, available, accepted. Nothing is waiting on you.",
      },
      {
        title: "Blue — in flight",
        body: "Under way or committed. Real work is happening and it is on track.",
      },
      {
        title: "Amber — needs a look",
        body: "Something wants a decision: information is missing, a coach is in for maintenance, a driver is on leave, a trip is mid-run.",
      },
      {
        title: "Grey — dormant",
        body: "Real but idle. Scheduled but not yet confirmed, off duty, expired.",
      },
      {
        title: "Red — stopped",
        body: "Cancelled or declined. It is not going to happen.",
      },
    ],
    notes: [
      "The full list of every status, by colour, is printed below from the same table the pills use — so it cannot fall out of date.",
    ],
  },
  {
    id: "roles",
    title: "Roles and permissions",
    icon: ShieldCheck,
    summary:
      "Enforced in the database, not just hidden in the interface. A role that cannot do something cannot do it by any route.",
    steps: [],
  },
  {
    id: "calendar",
    title: "Calendar",
    icon: CalendarDays,
    summary:
      "Not built yet. A calendar view of everything sold, including multi-day trips shown across every day they span, is the next thing being worked on.",
    steps: [],
    unbuilt: true,
  },
  {
    id: "troubleshooting",
    title: "When something looks wrong",
    icon: LifeBuoy,
    summary: "The handful of things that actually go wrong, and what they mean.",
    steps: [
      {
        title: "Every garage row says 'No garage'",
        body: "No default garage is set. Settings → General. Until then somebody picks one on every quote and dead kilometres read zero when they forget.",
      },
      {
        title: "Distances stay at zero",
        body: "The route could not be measured. Check both addresses are real; the itinerary will say so under the stops. You can always type the distance in by hand.",
      },
      {
        title: "A quote will not convert",
        body: "Almost always a trip with no pickup date. The message names the trip.",
      },
      {
        title: "The price is lower than it should be",
        body: "Check the Hours figure on the Pricing tab. If the coach waits somewhere and no wait time was entered, hours only counts driving and an hourly job is badly under-quoted.",
      },
      {
        title: "Everything feels slow",
        body: "This is the hosting, not your data. The database is small and correctly indexed; the delay is the plan the project runs on and how far away its region is.",
      },
    ],
  },
];

