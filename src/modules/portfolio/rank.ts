import type { Project, WsjfScore } from "./types";

export const WSJF_SCALE = [1, 2, 3, 5, 8, 13, 20] as const;

export const wsjf = (s: WsjfScore) => (s.value + s.timeCriticality + s.riskReduction) / s.size;

export function moveRank(projects: Project[], id: string, direction: -1 | 1): Project[] {
  const sorted = [...projects].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex((p) => p.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= sorted.length) return projects;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((p, k) => ({ ...p, rank: k + 1 }));
}

export function ranksAreUnique(projects: Project[]): boolean {
  return new Set(projects.map((p) => p.rank)).size === projects.length;
}

export type OrderError = "duplicate" | "missing" | "unknown";

/** An order is valid when it names every rankable project exactly once. Position is the rank, so ties cannot exist. */
export function validateOrder(projectIds: string[], order: string[]): OrderError | null {
  if (new Set(order).size !== order.length) return "duplicate";
  const known = new Set(projectIds);
  if (order.some((id) => !known.has(id))) return "unknown";
  if (order.length !== known.size) return "missing";
  return null;
}

/** Highest WSJF first; equal scores keep their current rank order. */
export function wsjfOrder(projects: Project[]): string[] {
  return [...projects].sort((a, b) => wsjf(b.wsjf) - wsjf(a.wsjf) || a.rank - b.rank).map((p) => p.id);
}

/** Projects whose rank differs from where WSJF alone would put them. */
export function deviationsFromWsjf(projects: Project[], order: string[]): string[] {
  const byWsjf = wsjfOrder(projects);
  return order.filter((id, i) => byWsjf[i] !== id);
}

export interface RankMove {
  projectId: string;
  from: number;
  to: number;
}

export function rankMoves(projects: Project[], order: string[]): RankMove[] {
  return order
    .map((projectId, i) => ({ projectId, from: projects.find((p) => p.id === projectId)!.rank, to: i + 1 }))
    .filter((m) => m.from !== m.to);
}
