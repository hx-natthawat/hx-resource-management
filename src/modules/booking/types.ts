import type { Level, Role, Week } from "../people/types";

export type BookingStatus = "Draft" | "Requested" | "Proposed" | "Confirmed" | "Released" | "Rejected";

export interface Booking {
  id: string;
  projectId: string;
  role: Role;
  skills: string[];
  level: Level;
  personId: string | null;
  hoursPerWeek: number;
  startWeek: Week;
  endWeek: Week;
  status: BookingStatus;
  requestedBy: string;
  note?: string;
  source: "voice" | "form" | "seed";
}
