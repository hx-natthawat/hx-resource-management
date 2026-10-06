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
