/** The run's times in the order the day happens; each must follow the last. */
export const RESERVATION_TIMES = [
  { key: "garage_arrival_at", label: "Leaves yard" },
  { key: "spot_at", label: "Spot" },
  { key: "departure_at", label: "Departs" },
  { key: "dropoff_at", label: "Last drop-off" },
  { key: "return_at", label: "Back in yard" },
] as const;

