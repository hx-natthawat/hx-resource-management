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
