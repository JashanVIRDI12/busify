/**
 * Supabase schema types.
 *
 * Hand-written to match supabase/migrations exactly, in the same shape the
 * generator emits — regenerate with `npm run db:types` (requires a running
 * local Supabase) and this file is a drop-in replacement.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrgRole =
  | "OWNER"
  | "ADMIN"
  | "DISPATCHER"
  | "DRIVER"
  | "ACCOUNTANT"
  | "STAFF";

export type VehicleStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "IN_TRIP"
  | "MAINTENANCE"
  | "INACTIVE";

export type DriverStatus =
  | "ACTIVE"
  | "OFF_DUTY"
  | "ON_TRIP"
  | "ON_LEAVE"
  | "INACTIVE";

export type DriverDocumentType =
  | "LICENSE"
  | "MEDICAL_CERTIFICATE"
  | "BACKGROUND_CHECK"
  | "TRAINING"
  | "OTHER";

export type TripRequestStatus =
  | "NEW"
  | "REVIEWING"
  | "NEEDS_INFORMATION"
  | "QUOTED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED";

export type TripRequestSource =
  | "DASHBOARD"
  | "WEBSITE_WIDGET"
  | "HOSTED_PAGE"
  | "API"
  | "AI";

export type TripStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "DISPATCHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type QuoteStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED";

export type QuoteItemKind =
  | "VEHICLE"
  | "DRIVER"
  | "FUEL"
  | "MILEAGE"
  | "TOLLS"
  | "ADDITIONAL_SERVICE"
  | "OTHER";

export type QuotePipelineStatus =
  | "LEAD"
  | "QUOTED"
  | "FOLLOW_UP"
  | "WON"
  | "LOST";

export type QuotePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type QuoteTripType =
  | "ONE_WAY"
  | "ROUND_TRIP"
  | "HOURLY"
  | "DAILY"
  | "SHUTTLE"
  | "OTHER";

export type QuoteCustomerVisibility =
  | "LINE_ITEM_TOTALS"
  | "LINE_ITEM_CALCS"
  | "TOTAL_ONLY";

export type QuoteStopKind = "PICKUP" | "STOP" | "DROPOFF";

export type QuoteChargeSection = "BASE_FARE" | "ITEMIZED" | "TAX";

export type QuoteChargeKind =
  | "FLAT"
  | "PERCENT"
  | "PER_MILE"
  | "PER_HOUR"
  | "PER_DAY";

export type QuoteBaseFareMode = "HIGHEST" | "CHOOSE";

export type QuoteBaseFareBasis = "DAILY" | "HOURLY" | "MILEAGE" | "BASE";

export type PaymentMethodKind = "CARD" | "BANK" | "CHECK" | "WIRE" | "OTHER";

export type QuoteOverageBasis = "HOURLY" | "MILEAGE" | "DAILY";

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

export type MaintenanceStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type TicketSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DriverPayStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "VOID";

export type ChargeCategory = "CHARGE" | "MARKUP" | "TAX";

export type ChargeRateType = "FLAT" | "PER_QUANTITY" | "PERCENTAGE";

export type ChargePlacement = "ITEMIZED" | "BASE_FARE";

export type DriverPayMethod = "HOURLY" | "PERCENTAGE";

export type DriverPaySwitch = "DAILY_RATE" | "HOURS";

export type EmailTemplateKind = "QUOTE_BOOKING" | "QUOTE_REQUEST" | "INVOICE";

export type TermsKind = "CONTRACT" | "QUOTE";

export type ReservationPaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "REFUNDED";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type ProfileRow = Timestamps & {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type OrganizationRow = Timestamps & {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  /** Province or territory code for Canadian organizations: ON, QC, BC... */
  state: string | null;
  postal_code: string | null;
  country: string;
  timezone: string;
  currency: string;
  /** CRA GST/HST registration number, printed on quotes. */
  gst_hst_number: string | null;
  // --- Company profile ------------------------------------------------------
  website: string | null;
  email_sender_name: string | null;
  bcc_email: string | null;
  sales_phone: string | null;
  operations_phone: string | null;
  fax: string | null;
  dot_number: string | null;
  address_line2: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  // --- Branding, used on the quote PDF and the checkout page -----------------
  favicon_url: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
};

type OrganizationSettingsRow = Timestamps & {
  organization_id: string;
  default_garage_id: string | null;
  pre_trip_arrival_minutes: number;
  spot_time_minutes: number;
  pricing_mode: QuoteBaseFareMode;
  /** Which bases `CHOOSE` sums. Ignored when `pricing_mode` is `HIGHEST`. */
  pricing_bases: string[];
  customer_visibility: QuoteCustomerVisibility;
  enable_sales_tax: boolean;
  enable_tracking_link: boolean;
  event_types: string[];
  widget_vehicle_types: string[];
  driver_pay_method: DriverPayMethod;
  long_day_enabled: boolean;
  long_day_hours: number;
  long_day_switch_to: DriverPaySwitch;
  overnight_enabled: boolean;
  overnight_switch_to: DriverPaySwitch;
  percentage_of_total: boolean;
  pay_rate_types: string[];
  per_trip_minimum_enabled: boolean;
  per_trip_minimum_by_hours: boolean;
  per_diem_enabled: boolean;
  per_diem_min_days: number;
};

type VehicleRateRow = Timestamps & {
  id: string;
  organization_id: string;
  /** Null vehicle_id means this is the default for the whole type. */
  vehicle_type_id: string | null;
  vehicle_id: string | null;
  live_mile_rate: number;
  dead_mile_rate: number;
  hourly_rate: number;
  minimum_hours: number;
  daily_rate: number;
};

type CustomChargeRow = Timestamps & {
  id: string;
  organization_id: string;
  category: ChargeCategory;
  name: string;
  rate_type: ChargeRateType;
  rate: number;
  placement: ChargePlacement;
  tax_exempt: boolean;
  default_on_quote: boolean;
  note: string | null;
  position: number;
};

type SavedStopRow = Timestamps & {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
};

type IndustryRow = Timestamps & {
  id: string;
  organization_id: string;
  /** The short number the console shows. A label, never a lookup key. */
  reference: number;
  name: string;
};

type EmailTemplateRow = Timestamps & {
  id: string;
  organization_id: string;
  kind: EmailTemplateKind;
  from_email: string | null;
  subject: string;
  body: string;
  include_pdf: boolean;
};

type OrganizationMemberRow = Timestamps & {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
};

type CompanyRow = Timestamps & {
  id: string;
  organization_id: string;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string;
  industry: string | null;
  groups: string[];
  notes: string | null;
};

type CustomerRow = Timestamps & {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  /** Free-text company name, kept for rows imported before `company_id`. */
  company: string | null;
  company_id: string | null;
  job_title: string | null;
  phone_extension: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string;
  industry: string | null;
  notes: string | null;
};

type VehicleTypeRow = Timestamps & {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  default_capacity: number | null;
  base_rate: number;
  per_km_rate: number;
  per_hour_rate: number;
  per_day_rate: number;
};

type VehicleRow = Timestamps & {
  id: string;
  organization_id: string;
  vehicle_type_id: string | null;
  name: string;
  /** The licence plate. Optional: fleet spreadsheets rarely carry it. */
  registration_number: string | null;
  capacity: number;
  status: VehicleStatus;
  location: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  image_url: string | null;
  garage_id: string | null;
  vin: string | null;
  amenities: string[];
  /** A placeholder coach held for a booking; excluded from availability. */
  is_mock: boolean;
  external_ref: string | null;
  notes: string | null;
};

type VehicleMaintenanceRow = Timestamps & {
  id: string;
  organization_id: string;
  vehicle_id: string;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  cost: number | null;
  odometer_km: number | null;
};

type DriverRow = Timestamps & {
  id: string;
  organization_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  license_number: string | null;
  license_class: string | null;
  /** Class Z in Ontario; the air brake endorsement elsewhere. */
  air_brake_endorsement: boolean;
  license_expires_on: string | null;
  status: DriverStatus;
  garage_id: string | null;
  notes: string | null;
};

type DriverDocumentRow = Timestamps & {
  id: string;
  organization_id: string;
  driver_id: string;
  type: DriverDocumentType;
  name: string;
  storage_path: string;
  issued_on: string | null;
  expires_on: string | null;
};

type DriverAvailabilityRow = Timestamps & {
  id: string;
  organization_id: string;
  driver_id: string;
  starts_at: string;
  ends_at: string;
  is_available: boolean;
  reason: string | null;
};

type TripRequestRow = Timestamps & {
  id: string;
  organization_id: string;
  customer_id: string | null;
  reference: string | null;
  pickup_location: string;
  pickup_address: string | null;
  destination: string;
  destination_address: string | null;
  departure_at: string;
  return_at: string | null;
  passenger_count: number;
  special_requirements: string | null;
  status: TripRequestStatus;
  source: TripRequestSource;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
};

type TripRow = Timestamps & {
  id: string;
  organization_id: string;
  trip_request_id: string | null;
  customer_id: string | null;
  pickup_location: string;
  destination: string;
  departure_at: string;
  return_at: string | null;
  passenger_count: number;
  status: TripStatus;
  notes: string | null;
  // --- Reservation fields ---------------------------------------------------
  /** The job number: inherited from the quote, suffixed per trip. */
  reference: string | null;
  quote_id: string | null;
  company_id: string | null;
  garage_id: string | null;
  group_name: string | null;
  total_due: number;
  amount_paid: number;
  /** Generated column — read only; write `total_due` and `amount_paid`. */
  balance_due: number;
  payment_status: ReservationPaymentStatus;
  /** Maintained by a trigger on trip_assignments; never written by the app. */
  assignment_status: "UNASSIGNED" | "PARTIAL" | "ASSIGNED";
  invoice_sent_at: string | null;
  garage_arrival_at: string | null;
  spot_at: string | null;
  dropoff_at: string | null;
  last_activity_at: string;
  created_by: string | null;
};

type TripAssignmentRow = Timestamps & {
  id: string;
  organization_id: string;
  trip_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  role: string;
  notes: string | null;
};

type TripPassengerRow = Timestamps & {
  id: string;
  organization_id: string;
  trip_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  seat_label: string | null;
  notes: string | null;
};

type QuoteRow = Timestamps & {
  id: string;
  organization_id: string;
  trip_request_id: string | null;
  customer_id: string | null;
  quote_number: string | null;
  subtotal: number;
  tax: number;
  /** The rate actually charged, kept because rates change over time. */
  tax_rate_percent: number;
  /** Place of supply: the province the journey starts in. */
  tax_province: string | null;
  discount: number;
  total: number;
  deposit_amount: number;
  currency: string;
  valid_until: string | null;
  status: QuoteStatus;
  public_token: string;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  notes: string | null;
  // --- Quote builder header fields -----------------------------------------
  title: string;
  pipeline_status: QuotePipelineStatus;
  priority: QuotePriority | null;
  sales_rep_id: string | null;
  event_name: string | null;
  referred_by: string | null;
  tags: string[];
  billing_customer_id: string | null;
  customer_visibility: QuoteCustomerVisibility;
  allow_instant_booking: boolean;
  allow_pay_later: boolean;
  allow_full_card_payment: boolean;
  po_number: string | null;
  po_only: boolean;
  payment_policy: string | null;
  require_signature: boolean;
  expiry_days: number | null;
  expiry_anchor: "FIRST_SENT" | "LAST_SENT";
  contract_terms_id: string | null;
  overage_basis: QuoteOverageBasis | null;
  overage_rate: number | null;
  first_sent_at: string | null;
  /** The job number shown in the console. Shared with the resulting trips. */
  reference: string | null;
  company_id: string | null;
  event_type: string | null;
  created_by: string | null;
  expires_at: string | null;
  /** Denormalised from the first stop of the first trip, on every save. */
  pickup_at: string | null;
  pickup_address: string | null;
};

type TicketRow = Timestamps & {
  id: string;
  organization_id: string;
  reference: string | null;
  trip_id: string | null;
  title: string;
  ticket_type: string | null;
  status: TicketStatus;
  severity: TicketSeverity;
  assignee_id: string | null;
  created_by: string | null;
  body: string | null;
  resolved_at: string | null;
};

type TicketCommentRow = Timestamps & {
  id: string;
  organization_id: string;
  ticket_id: string;
  author_id: string | null;
  body: string;
};

type DriverPayStubRow = Timestamps & {
  id: string;
  organization_id: string;
  reference: string;
  driver_id: string;
  status: DriverPayStatus;
  total_pay: number;
  payment_date: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
};

type DriverPayEntryRow = Timestamps & {
  id: string;
  organization_id: string;
  trip_id: string;
  driver_id: string;
  pay_stub_id: string | null;
  status: DriverPayStatus;
  rate_basis: "FLAT" | "HOURLY" | "DAILY" | "MILEAGE";
  rate: number;
  quantity: number;
  total_pay: number;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
};

type QuoteFileRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  content_type: string | null;
  uploaded_by: string | null;
};

type SavedViewRow = Timestamps & {
  id: string;
  organization_id: string;
  user_id: string;
  /** The list this view belongs to: "quotes", "reservations", "contacts"... */
  resource: string;
  name: string;
  /** A URL query string, stored verbatim. */
  query: string;
  position: number;
  is_shared: boolean;
};

type ContractTermsRow = Timestamps & {
  id: string;
  organization_id: string;
  name: string;
  body: string;
  is_default: boolean;
  /** The same table backs the contract terms and the quote-page terms. */
  kind: TermsKind;
};

type GarageRow = Timestamps & {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  notes: string | null;
};

type QuoteTripRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_id: string;
  position: number;
  name: string;
  trip_type: QuoteTripType | null;
  passenger_count: number | null;
  driver_count: number | null;
  trip_contact_name: string | null;
  trip_contact_email: string | null;
  trip_contact_phone: string | null;
  departing_garage_id: string | null;
  departing_note: string | null;
  departing_date: string | null;
  departing_time: string | null;
  departing_arrival_time: string | null;
  returning_garage_id: string | null;
  returning_note: string | null;
  returning_date: string | null;
  returning_time: string | null;
  return_leg_miles: number;
  return_leg_minutes: number;
  base_fare_mode: QuoteBaseFareMode;
  base_fare_basis: QuoteBaseFareBasis | null;
  rate_daily: number;
  rate_hourly: number;
  rate_per_mile: number;
  rate_flat_base: number;
  base_fare_override: number | null;
  days: number;
  hours: number;
  total_miles: number;
  dead_miles: number;
  live_miles: number;
  estimated_minutes: number;
  base_fare_total: number;
  subtotal: number;
  tax_total: number;
  total: number;
  due_now_percent: number;
  due_now_amount: number | null;
  balance_due_date: string | null;
  recurrence: Json | null;
  notes: string | null;
};

type QuoteTripStopRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_trip_id: string;
  position: number;
  kind: QuoteStopKind;
  label: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  stop_date: string | null;
  stop_time: string | null;
  spot_time: string | null;
  notes: string | null;
  leg_miles: number;
  leg_minutes: number;
};

type QuoteTripVehicleRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_trip_id: string;
  position: number;
  vehicle_type_id: string | null;
  vehicle_id: string | null;
  quantity: number;
};

type QuoteTripChargeRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_trip_id: string;
  position: number;
  section: QuoteChargeSection;
  label: string;
  kind: QuoteChargeKind;
  rate: number;
  quantity: number;
  amount: number;
  taxable: boolean;
};

type QuotePaymentMethodRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_id: string;
  method: PaymentMethodKind;
  position: number;
  enabled: boolean;
  online_processing: boolean;
  processing_fee_percent: number;
  customer_note: string | null;
};

type QuoteItemRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_id: string;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  position: number;
};

type BookingRow = Timestamps & {
  id: string;
  organization_id: string;
  quote_id: string | null;
  trip_id: string | null;
  customer_id: string | null;
  booking_number: string | null;
  status: BookingStatus;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  currency: string;
};

type BookingPassengerRow = Timestamps & {
  id: string;
  organization_id: string;
  booking_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

/**
 * Insert shape: the listed columns are required, everything else (including
 * id/created_at/updated_at, which the database fills in) is optional.
 */
type Insert<T, RequiredKeys extends keyof T> = Pick<T, RequiredKeys> &
  Partial<Omit<T, RequiredKeys>>;

type Update<T> = Partial<T>;

/**
 * One foreign key, in the shape PostgREST's select-query type resolver reads.
 *
 * Only *forward* references are declared — the column lives on this table and
 * points at another. That is what makes `.select("*, companies(name)")` resolve
 * to a single embedded object rather than an array.
 *
 * A pair of tables joined by two different foreign keys (quotes has both
 * `customer_id` and `billing_customer_id` into customers) is deliberately left
 * undeclared: PostgREST cannot resolve that embed without a disambiguating
 * hint at runtime, so allowing it in the types would only let the mistake reach
 * production. Those relationships are read with a second query instead.
 */
type Rel<
  Name extends string,
  Column extends string,
  Target extends string,
  TargetColumn extends string = "id",
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: [TargetColumn];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insert<ProfileRow, "id">;
        Update: Update<ProfileRow>;
        Relationships: [];
      };
      organizations: {
        Row: OrganizationRow;
        Insert: Insert<OrganizationRow, "name" | "slug">;
        Update: Update<OrganizationRow>;
        Relationships: [];
      };
      organization_settings: {
        Row: OrganizationSettingsRow;
        Insert: Insert<OrganizationSettingsRow, "organization_id">;
        Update: Update<OrganizationSettingsRow>;
        Relationships: [
          Rel<"organization_settings_garage_fk", "default_garage_id", "garages">,
        ];
      };
      vehicle_rates: {
        Row: VehicleRateRow;
        Insert: Insert<VehicleRateRow, "organization_id">;
        Update: Update<VehicleRateRow>;
        Relationships: [
          Rel<"vehicle_rates_type_fk", "vehicle_type_id", "vehicle_types">,
          Rel<"vehicle_rates_vehicle_fk", "vehicle_id", "vehicles">,
        ];
      };
      custom_charges: {
        Row: CustomChargeRow;
        Insert: Insert<CustomChargeRow, "organization_id" | "name">;
        Update: Update<CustomChargeRow>;
        Relationships: [];
      };
      saved_stops: {
        Row: SavedStopRow;
        Insert: Insert<SavedStopRow, "organization_id" | "name">;
        Update: Update<SavedStopRow>;
        Relationships: [];
      };
      industries: {
        Row: IndustryRow;
        Insert: Insert<IndustryRow, "organization_id" | "name">;
        Update: Update<IndustryRow>;
        Relationships: [];
      };
      email_templates: {
        Row: EmailTemplateRow;
        Insert: Insert<EmailTemplateRow, "organization_id" | "kind">;
        Update: Update<EmailTemplateRow>;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: Insert<OrganizationMemberRow, "organization_id" | "user_id">;
        Update: Update<OrganizationMemberRow>;
        Relationships: [];
      };
      companies: {
        Row: CompanyRow;
        Insert: Insert<CompanyRow, "organization_id" | "name">;
        Update: Update<CompanyRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: Insert<CustomerRow, "organization_id" | "first_name">;
        Update: Update<CustomerRow>;
        Relationships: [Rel<"customers_company_fk", "company_id", "companies">];
      };
      tickets: {
        Row: TicketRow;
        Insert: Insert<TicketRow, "organization_id" | "title">;
        Update: Update<TicketRow>;
        Relationships: [Rel<"tickets_trip_fk", "trip_id", "trips">];
      };
      ticket_comments: {
        Row: TicketCommentRow;
        Insert: Insert<
          TicketCommentRow,
          "organization_id" | "ticket_id" | "body"
        >;
        Update: Update<TicketCommentRow>;
        Relationships: [Rel<"ticket_comments_ticket_fk", "ticket_id", "tickets">];
      };
      driver_pay_stubs: {
        Row: DriverPayStubRow;
        Insert: Insert<
          DriverPayStubRow,
          "organization_id" | "reference" | "driver_id"
        >;
        Update: Update<DriverPayStubRow>;
        Relationships: [Rel<"driver_pay_stubs_driver_fk", "driver_id", "drivers">];
      };
      driver_pay_entries: {
        Row: DriverPayEntryRow;
        Insert: Insert<
          DriverPayEntryRow,
          "organization_id" | "trip_id" | "driver_id"
        >;
        Update: Update<DriverPayEntryRow>;
        Relationships: [
          Rel<"driver_pay_entries_trip_fk", "trip_id", "trips">,
          Rel<"driver_pay_entries_driver_fk", "driver_id", "drivers">,
          Rel<
            "driver_pay_entries_stub_fk",
            "pay_stub_id",
            "driver_pay_stubs"
          >,
        ];
      };
      quote_files: {
        Row: QuoteFileRow;
        Insert: Insert<
          QuoteFileRow,
          "organization_id" | "quote_id" | "name" | "storage_path"
        >;
        Update: Update<QuoteFileRow>;
        Relationships: [Rel<"quote_files_quote_fk", "quote_id", "quotes">];
      };
      saved_views: {
        Row: SavedViewRow;
        Insert: Insert<
          SavedViewRow,
          "organization_id" | "user_id" | "resource" | "name"
        >;
        Update: Update<SavedViewRow>;
        Relationships: [];
      };
      vehicle_types: {
        Row: VehicleTypeRow;
        Insert: Insert<VehicleTypeRow, "organization_id" | "name">;
        Update: Update<VehicleTypeRow>;
        Relationships: [];
      };
      vehicles: {
        Row: VehicleRow;
        Insert: Insert<VehicleRow, "organization_id" | "name" | "capacity">;
        Update: Update<VehicleRow>;
        Relationships: [
          Rel<"vehicles_type_fk", "vehicle_type_id", "vehicle_types">,
          Rel<"vehicles_garage_fk", "garage_id", "garages">,
        ];
      };
      vehicle_maintenance: {
        Row: VehicleMaintenanceRow;
        Insert: Insert<
          VehicleMaintenanceRow,
          "organization_id" | "vehicle_id" | "title"
        >;
        Update: Update<VehicleMaintenanceRow>;
        Relationships: [];
      };
      drivers: {
        Row: DriverRow;
        Insert: Insert<DriverRow, "organization_id" | "first_name">;
        Update: Update<DriverRow>;
        Relationships: [Rel<"drivers_garage_fk", "garage_id", "garages">];
      };
      driver_documents: {
        Row: DriverDocumentRow;
        Insert: Insert<
          DriverDocumentRow,
          "organization_id" | "driver_id" | "name" | "storage_path"
        >;
        Update: Update<DriverDocumentRow>;
        Relationships: [];
      };
      driver_availability: {
        Row: DriverAvailabilityRow;
        Insert: Insert<
          DriverAvailabilityRow,
          "organization_id" | "driver_id" | "starts_at" | "ends_at"
        >;
        Update: Update<DriverAvailabilityRow>;
        Relationships: [];
      };
      trip_requests: {
        Row: TripRequestRow;
        Insert: Insert<
          TripRequestRow,
          | "organization_id"
          | "pickup_location"
          | "destination"
          | "departure_at"
          | "passenger_count"
        >;
        Update: Update<TripRequestRow>;
        Relationships: [];
      };
      trips: {
        Row: TripRow;
        Insert: Insert<
          TripRow,
          | "organization_id"
          | "pickup_location"
          | "destination"
          | "departure_at"
          | "passenger_count"
        >;
        Update: Update<TripRow>;
        Relationships: [
          Rel<"trips_customer_fk", "customer_id", "customers">,
          Rel<"trips_company_fk", "company_id", "companies">,
          Rel<"trips_quote_fk", "quote_id", "quotes">,
          Rel<"trips_garage_fk", "garage_id", "garages">,
          Rel<"trips_request_fk", "trip_request_id", "trip_requests">,
        ];
      };
      trip_assignments: {
        Row: TripAssignmentRow;
        Insert: Insert<TripAssignmentRow, "organization_id" | "trip_id">;
        Update: Update<TripAssignmentRow>;
        Relationships: [
          Rel<"trip_assignments_trip_fk", "trip_id", "trips">,
          Rel<"trip_assignments_vehicle_fk", "vehicle_id", "vehicles">,
          Rel<"trip_assignments_driver_fk", "driver_id", "drivers">,
        ];
      };
      trip_passengers: {
        Row: TripPassengerRow;
        Insert: Insert<
          TripPassengerRow,
          "organization_id" | "trip_id" | "full_name"
        >;
        Update: Update<TripPassengerRow>;
        Relationships: [];
      };
      quotes: {
        Row: QuoteRow;
        Insert: Insert<QuoteRow, "organization_id">;
        Update: Update<QuoteRow>;
        // No `customers` relationship: quotes reach it through both
        // `customer_id` and `billing_customer_id`, which PostgREST cannot
        // disambiguate. Read the contact with a separate query.
        Relationships: [
          Rel<"quotes_company_fk", "company_id", "companies">,
          Rel<"quotes_contract_terms_fk", "contract_terms_id", "contract_terms">,
          Rel<"quotes_request_fk", "trip_request_id", "trip_requests">,
        ];
      };
      quote_items: {
        Row: QuoteItemRow;
        Insert: Insert<
          QuoteItemRow,
          "organization_id" | "quote_id" | "description"
        >;
        Update: Update<QuoteItemRow>;
        Relationships: [];
      };
      contract_terms: {
        Row: ContractTermsRow;
        Insert: Insert<ContractTermsRow, "organization_id" | "name">;
        Update: Update<ContractTermsRow>;
        Relationships: [];
      };
      garages: {
        Row: GarageRow;
        Insert: Insert<GarageRow, "organization_id" | "name">;
        Update: Update<GarageRow>;
        Relationships: [];
      };
      quote_trips: {
        Row: QuoteTripRow;
        Insert: Insert<QuoteTripRow, "organization_id" | "quote_id">;
        Update: Update<QuoteTripRow>;
        Relationships: [Rel<"quote_trips_quote_fk", "quote_id", "quotes">];
      };
      quote_trip_stops: {
        Row: QuoteTripStopRow;
        Insert: Insert<QuoteTripStopRow, "organization_id" | "quote_trip_id">;
        Update: Update<QuoteTripStopRow>;
        Relationships: [
          Rel<"quote_trip_stops_trip_fk", "quote_trip_id", "quote_trips">,
        ];
      };
      quote_trip_vehicles: {
        Row: QuoteTripVehicleRow;
        Insert: Insert<QuoteTripVehicleRow, "organization_id" | "quote_trip_id">;
        Update: Update<QuoteTripVehicleRow>;
        Relationships: [
          Rel<"quote_trip_vehicles_trip_fk", "quote_trip_id", "quote_trips">,
        ];
      };
      quote_trip_charges: {
        Row: QuoteTripChargeRow;
        Insert: Insert<
          QuoteTripChargeRow,
          "organization_id" | "quote_trip_id" | "section"
        >;
        Update: Update<QuoteTripChargeRow>;
        Relationships: [
          Rel<"quote_trip_charges_trip_fk", "quote_trip_id", "quote_trips">,
        ];
      };
      quote_payment_methods: {
        Row: QuotePaymentMethodRow;
        Insert: Insert<
          QuotePaymentMethodRow,
          "organization_id" | "quote_id" | "method"
        >;
        Update: Update<QuotePaymentMethodRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Insert<BookingRow, "organization_id">;
        Update: Update<BookingRow>;
        Relationships: [];
      };
      booking_passengers: {
        Row: BookingPassengerRow;
        Insert: Insert<
          BookingPassengerRow,
          "organization_id" | "booking_id" | "full_name"
        >;
        Update: Update<BookingPassengerRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_organization: {
        Args: {
          p_name: string;
          p_phone?: string | null;
          p_email?: string | null;
          p_city?: string | null;
          p_state?: string | null;
          p_postal_code?: string | null;
          p_country?: string | null;
          p_timezone?: string | null;
          p_currency?: string | null;
        };
        Returns: OrganizationRow;
      };
    };
    Enums: {
      org_role: OrgRole;
      vehicle_status: VehicleStatus;
      driver_status: DriverStatus;
      driver_document_type: DriverDocumentType;
      trip_request_status: TripRequestStatus;
      trip_request_source: TripRequestSource;
      trip_status: TripStatus;
      quote_status: QuoteStatus;
      quote_item_kind: QuoteItemKind;
      quote_pipeline_status: QuotePipelineStatus;
      quote_priority: QuotePriority;
      quote_trip_type: QuoteTripType;
      quote_customer_visibility: QuoteCustomerVisibility;
      quote_stop_kind: QuoteStopKind;
      quote_charge_section: QuoteChargeSection;
      quote_charge_kind: QuoteChargeKind;
      quote_base_fare_mode: QuoteBaseFareMode;
      quote_base_fare_basis: QuoteBaseFareBasis;
      payment_method_kind: PaymentMethodKind;
      quote_overage_basis: QuoteOverageBasis;
      booking_status: BookingStatus;
      maintenance_status: MaintenanceStatus;
      ticket_status: TicketStatus;
      ticket_severity: TicketSeverity;
      driver_pay_status: DriverPayStatus;
      reservation_payment_status: ReservationPaymentStatus;
      charge_category: ChargeCategory;
      charge_rate_type: ChargeRateType;
      charge_placement: ChargePlacement;
      driver_pay_method: DriverPayMethod;
      driver_pay_switch: DriverPaySwitch;
      email_template_kind: EmailTemplateKind;
      terms_kind: TermsKind;
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicTables = Database["public"]["Tables"];

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> =
  PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> =
  PublicTables[T]["Update"];
