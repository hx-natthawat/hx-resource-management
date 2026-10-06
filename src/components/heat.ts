export function heatClass(percent: number): string {
  if (percent > 100) return "bg-hx-over text-white";
  if (percent >= 90) return "bg-hx-blue text-white";
  if (percent >= 50) return "bg-hx-sky text-hx-blue-deep";
  return "bg-hx-tint-2 text-hx-blue";
}

export const STATUS_PILL: Record<string, string> = {
  Draft: "bg-hx-line text-hx-muted",
  Requested: "bg-hx-warn-bg text-hx-gold-text",
  Proposed: "bg-hx-tint-2 text-hx-blue",
  Confirmed: "bg-hx-ok-bg text-hx-ok",
  Released: "bg-hx-line text-hx-muted",
  Rejected: "bg-hx-over-bg text-hx-over",
};

export const SOURCE_PILL = {
  heard: { label: "จากเสียง", cls: "bg-hx-tint-2 text-hx-blue" },
  inferred: { label: "ระบบตีความ", cls: "bg-hx-warn-bg text-hx-gold-text" },
  account: { label: "จากบัญชี", cls: "bg-hx-tint-2 text-hx-blue" },
  edited: { label: "แก้ไขแล้ว", cls: "bg-hx-ok-bg text-hx-ok" },
} as const;
