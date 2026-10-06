/** Who may do what (ADR-005 RBAC). The API checks every write against this table. */
export type AppRole = "PM" | "RM" | "Council" | "Executive" | "Admin";

export type Action =
  | "demand.create"
  | "booking.confirm"
  | "booking.reject"
  | "conflict.decide"
  | "rank.edit"
  | "rank.publish"
  | "draft.create";

const RULES: Record<Action, AppRole[]> = {
  "draft.create": ["PM", "RM", "Admin"],
  "demand.create": ["PM", "RM", "Admin"],
  "booking.confirm": ["RM", "Admin"],
  "booking.reject": ["RM", "Admin"],
  "conflict.decide": ["RM", "Council", "Admin"],
  "rank.edit": ["Executive", "Admin"],
  "rank.publish": ["Executive", "Admin"],
};

export const can = (role: AppRole, action: Action) => RULES[action].includes(role);

export const ROLE_LABEL: Record<AppRole, string> = {
  PM: "Project Manager",
  RM: "Resource Manager",
  Council: "Resource Council",
  Executive: "ผู้บริหาร",
  Admin: "ผู้ดูแลระบบ",
};
