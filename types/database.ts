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
};

type OrganizationMemberRow = Timestamps & {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
};

type CustomerRow = Timestamps & {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
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
};

type VehicleRow = Timestamps & {
  id: string;
  organization_id: string;
  vehicle_type_id: string | null;
  name: string;
  registration_number: string;
  capacity: number;
  status: VehicleStatus;
  location: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  image_url: string | null;
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
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: Insert<OrganizationMemberRow, "organization_id" | "user_id">;
        Update: Update<OrganizationMemberRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: Insert<CustomerRow, "organization_id" | "first_name">;
        Update: Update<CustomerRow>;
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
        Insert: Insert<
          VehicleRow,
          "organization_id" | "name" | "registration_number" | "capacity"
        >;
        Update: Update<VehicleRow>;
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      trip_assignments: {
        Row: TripAssignmentRow;
        Insert: Insert<TripAssignmentRow, "organization_id" | "trip_id">;
        Update: Update<TripAssignmentRow>;
        Relationships: [];
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
        Relationships: [];
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
      booking_status: BookingStatus;
      maintenance_status: MaintenanceStatus;
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
