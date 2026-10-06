import type { Week } from "../people/types";

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
