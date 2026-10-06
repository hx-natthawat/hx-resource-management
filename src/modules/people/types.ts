export const LEVELS = ["Junior", "Mid", "Senior"] as const;
export type Level = (typeof LEVELS)[number];

export const ROLES = ["Solution Architect", "Senior Developer", "Developer", "UX/UI Designer", "QA Engineer", "Project Manager", "Data Engineer", "DevOps Engineer"] as const;
export type Role = (typeof ROLES)[number];

export type { Week } from "./week";

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
