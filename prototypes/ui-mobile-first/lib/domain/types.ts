export type Level = "Junior" | "Mid" | "Senior";

export type Role =
  | "Solution Architect"
  | "Senior Developer"
  | "Developer"
  | "UX/UI Designer"
  | "QA Engineer"
  | "Project Manager"
  | "Data Engineer"
  | "DevOps Engineer";

export type Week = number;

export interface Person {
  id: string;
  name: string;
  role: Role;
  company: "HarmonyX" | "Certogo" | "Axebee";
  level: Level;
  skills: string[];
  capacityHours: number;
  isKeyResource: boolean;
  wipLimit: number;
}

export type ProjectStatus = "Pipeline" | "Active" | "On-hold" | "Closed";

export interface WsjfScore {
  value: number;
  timeCriticality: number;
  riskReduction: number;
  size: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  rank: number;
  wsjf: WsjfScore;
  winProbability?: number;
  rankNote?: string;
}

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

export interface Conflict {
  personId: string;
  weeks: Week[];
  peakPercent: number;
  bookingIds: string[];
}

export type DecisionKind = "shift" | "substitute" | "reduce";

export interface Decision {
  id: string;
  personId: string;
  weeks: Week[];
  kind: DecisionKind;
  summary: string;
  followedRecommendation: boolean;
  reason: string;
  decidedBy: string;
  decidedAt: string;
}
