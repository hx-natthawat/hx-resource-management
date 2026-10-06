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
