import type { Level, Role, Week } from "../../people/types";
import type { Project } from "../../portfolio/types";

export type FieldSource = "heard" | "inferred" | "account" | "edited";

export interface Field<T> {
  value: T;
  source: FieldSource;
  heard?: string;
}

export interface DemandDraft {
  id: string;
  transcript: string[];
  role?: Field<Role>;
  projectId?: Field<string>;
  level?: Field<Level>;
  skills?: Field<string[]>;
  hoursPerWeek?: Field<number>;
  startWeek?: Field<Week>;
  endWeek?: Field<Week>;
  requestedBy: Field<string>;
  createdAt: string;
}

export const REQUIRED = ["role", "projectId", "level", "hoursPerWeek", "startWeek", "endWeek"] as const;
export type RequiredKey = (typeof REQUIRED)[number];

const QUESTIONS: Record<RequiredKey, string> = {
  role: "ต้องการคนตำแหน่งใดครับ เช่น Architect, Developer หรือ QA",
  projectId: "ขอให้โครงการใดครับ",
  level: "ต้องการระดับ Senior, Mid หรือ Junior ครับ",
  hoursPerWeek: "ต้องการกี่ชั่วโมงหรือกี่วันต่อสัปดาห์ครับ",
  startWeek: "เริ่มเมื่อไรครับ",
  endWeek: "ใช้ถึงเมื่อไรครับ",
};

const ROLE_RULES: { re: RegExp; role: Role }[] = [
  { re: /architect|อาร์คิเท|สถาปนิก/, role: "Solution Architect" },
  { re: /devops|เดฟออปส์/, role: "DevOps Engineer" },
  { re: /\bqa\b|tester|เทสเตอร์|ทดสอบ/, role: "QA Engineer" },
  { re: /\bux\b|\bui\b|designer|ดีไซน์|ดีไซเนอร์/, role: "UX/UI Designer" },
  { re: /data|ดาต้า/, role: "Data Engineer" },
  { re: /\bpm\b|project manager|ผู้จัดการโครงการ/, role: "Project Manager" },
  { re: /\bdev\b|developer|เดฟ|โปรแกรมเมอร์|นักพัฒนา/, role: "Developer" },
];

const SKILL_RULES: { re: RegExp; skill: string }[] = [
  { re: /integration|อินทิเกรช/, skill: "Integration" },
  { re: /\baws\b/, skill: "AWS" },
  { re: /\bgcp\b/, skill: "GCP" },
  { re: /react|รีแอค/, skill: "React" },
  { re: /node/, skill: "Node" },
  { re: /python|ไพทอน/, skill: "Python" },
  { re: /kubernetes|\bk8s\b/, skill: "Kubernetes" },
  { re: /figma/, skill: "Figma" },
];

const THAI_DIGITS: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5 };
const toNumber = (s: string) => THAI_DIGITS[s] ?? Number(s);

const MONTHS: [RegExp, number][] = [
  [/มกรา|ม\.ค\./, 1], [/กุมภา|ก\.พ\./, 2], [/มีนา|มี\.ค\./, 3], [/เมษา|เม\.ย\./, 4],
  [/พฤษภา|พ\.ค\./, 5], [/มิถุนา|มิ\.ย\./, 6], [/กรกฎา|ก\.ค\./, 7], [/สิงหา|ส\.ค\./, 8],
  [/กันยา|ก\.ย\./, 9], [/ตุลา|ต\.ค\./, 10], [/พฤศจิกา|พ\.ย\./, 11], [/ธันวา|ธ\.ค\./, 12],
];

export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function weekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  return monday;
}

const THAI_MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function formatWeekRange(year: number, start: number, end: number): string {
  const s = weekStart(year, start);
  const e = weekStart(year, end);
  e.setUTCDate(e.getUTCDate() + 4);
  const f = (d: Date) => `${d.getUTCDate()} ${THAI_MONTH_SHORT[d.getUTCMonth()]}`;
  return `${f(s)} ถึง ${f(e)} (W${start} ถึง W${end})`;
}

function parsePeriod(text: string, year: number, today: Date): { start?: number; end?: number; heard?: string } {
  const hits: { month: number; mod: string; index: number; raw: string }[] = [];
  for (const [re, month] of MONTHS) {
    const g = new RegExp(`(ต้น|กลาง|ปลาย)?\\s*(?:เดือน)?\\s*(?:${re.source})[^\\s]*`, "g");
    for (const m of text.matchAll(g)) hits.push({ month, mod: m[1] ?? "", index: m.index ?? 0, raw: m[0] });
  }
  if (/เดือนหน้า/.test(text)) {
    const month = ((today.getUTCMonth() + 1) % 12) + 1;
    hits.push({ month, mod: "", index: text.indexOf("เดือนหน้า"), raw: "เดือนหน้า" });
  }
  if (hits.length === 0) return {};
  hits.sort((a, b) => a.index - b.index);
  const startDay = (mod: string) => (mod === "กลาง" ? 11 : mod === "ปลาย" ? 21 : 1);
  const endDay = (mod: string, month: number) =>
    mod === "ต้น" ? 10 : mod === "กลาง" ? 20 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = hits[0];
  const last = hits[hits.length - 1];
  return {
    start: isoWeek(new Date(Date.UTC(year, first.month - 1, startDay(first.mod)))),
    end: isoWeek(new Date(Date.UTC(year, last.month - 1, endDay(last.mod, last.month)))),
    heard: hits.length > 1 ? `${first.raw} ถึง ${last.raw}` : first.raw,
  };
}

function parseHours(text: string): Field<number> | undefined {
  const hours = text.match(/(\d+)\s*(ชั่วโมง|ชม)/);
  if (hours) return { value: Number(hours[1]), source: "heard", heard: hours[0] };
  const days = text.match(/(\d+|หนึ่ง|สอง|สาม|สี่|ห้า)\s*วัน/);
  if (days) return { value: toNumber(days[1]) * 8, source: "inferred", heard: days[0] };
  const pct = text.match(/(\d+)\s*(%|เปอร์เซ็นต์)/);
  if (pct) return { value: Math.round(Number(pct[1]) * 0.4), source: "inferred", heard: pct[0] };
  if (/เต็มเวลา|ฟูลไทม์|full ?time/.test(text)) return { value: 40, source: "inferred", heard: "เต็มเวลา" };
  if (/ครึ่งเวลา|ครึ่งหนึ่ง|part ?time/.test(text)) return { value: 20, source: "inferred", heard: "ครึ่งเวลา" };
  return undefined;
}

const GENERIC_WORDS = new Set(["ระบบ", "โครงการ", "กลุ่มบริษัท", "platform", "engine"]);

function matchProject(text: string, projects: Project[]): Project | undefined {
  const full = projects.find((p) => text.includes(p.name.toLowerCase()));
  if (full) return full;
  let best: { project: Project; len: number } | undefined;
  for (const p of projects) {
    for (const token of p.name.toLowerCase().split(/\s+/)) {
      if (token.length < 3 || GENERIC_WORDS.has(token) || !text.includes(token)) continue;
      if (!best || token.length > best.len) best = { project: p, len: token.length };
    }
  }
  return best?.project;
}

export interface ExtractContext {
  projects: Project[];
  requestedBy: string;
  year: number;
  today: Date;
  newId: () => string;
}

export function extract(utterance: string, ctx: ExtractContext, prev?: DemandDraft): DemandDraft {
  const text = utterance.toLowerCase();
  const draft: DemandDraft = prev
    ? { ...prev, transcript: [...prev.transcript, utterance] }
    : { id: ctx.newId(), transcript: [utterance], requestedBy: { value: ctx.requestedBy, source: "account" }, createdAt: ctx.today.toISOString() };

  const roleRule = ROLE_RULES.find((r) => r.re.test(text));
  if (roleRule) {
    const heard = text.match(roleRule.re)?.[0];
    const literal = text.includes(roleRule.role.toLowerCase());
    draft.role = { value: roleRule.role, source: literal ? "heard" : "inferred", heard };
  }

  const level: Level | undefined = /ซีเนียร์|senior/.test(text) ? "Senior" : /มิด|\bmid\b/.test(text) ? "Mid" : /จูเนียร์|junior/.test(text) ? "Junior" : undefined;
  if (level) draft.level = { value: level, source: "heard", heard: level };
  if (draft.role?.value === "Developer" && draft.level?.value === "Senior") {
    draft.role = { ...draft.role, value: "Senior Developer" };
  }

  const skills = SKILL_RULES.filter((s) => s.re.test(text)).map((s) => s.skill);
  if (skills.length) {
    const merged = Array.from(new Set([...(draft.skills?.value ?? []), ...skills]));
    draft.skills = { value: merged, source: "heard", heard: skills.join(", ") };
  }

  const project = matchProject(text, ctx.projects);
  if (project) draft.projectId = { value: project.id, source: "heard", heard: project.name };

  const hours = parseHours(text);
  if (hours) draft.hoursPerWeek = hours;

  const period = parsePeriod(utterance, ctx.year, ctx.today);
  if (period.start !== undefined) draft.startWeek = { value: period.start, source: "inferred", heard: period.heard };
  if (period.end !== undefined) draft.endWeek = { value: period.end, source: "inferred", heard: period.heard };

  return draft;
}

export const missing = (d: DemandDraft): RequiredKey[] => REQUIRED.filter((k) => d[k] === undefined);

export const nextQuestion = (d: DemandDraft): string | null => {
  const m = missing(d);
  return m.length ? QUESTIONS[m[0]] : null;
};

export const inferredCount = (d: DemandDraft) =>
  [d.role, d.projectId, d.level, d.skills, d.hoursPerWeek, d.startWeek].filter((f) => f?.source === "inferred").length;
