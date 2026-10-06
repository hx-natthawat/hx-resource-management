import type { Booking, Person, Project } from "../domain/types";

export const SEED_PEOPLE: Person[] = [
  { id: "p-anan", name: "อนันต์ ส.", role: "Solution Architect", company: "HarmonyX", level: "Senior", skills: ["Integration", "AWS", "Architecture"], capacityHours: 40, isKeyResource: true, wipLimit: 2 },
  { id: "p-pim", name: "พิมพ์ชนก ร.", role: "Senior Developer", company: "HarmonyX", level: "Senior", skills: ["React", "Node"], capacityHours: 40, isKeyResource: true, wipLimit: 2 },
  { id: "p-chayapol", name: "ชยพล ก.", role: "Solution Architect", company: "HarmonyX", level: "Senior", skills: ["Integration", "AWS"], capacityHours: 40, isKeyResource: false, wipLimit: 3 },
  { id: "p-malee", name: "มาลี ร.", role: "Developer", company: "HarmonyX", level: "Mid", skills: ["Integration", "Node"], capacityHours: 40, isKeyResource: false, wipLimit: 3 },
  { id: "p-thanakorn", name: "ธนกร ว.", role: "Developer", company: "HarmonyX", level: "Mid", skills: ["React", "Node"], capacityHours: 40, isKeyResource: false, wipLimit: 3 },
  { id: "p-siriporn", name: "ศิริพร ม.", role: "UX/UI Designer", company: "HarmonyX", level: "Mid", skills: ["Figma"], capacityHours: 40, isKeyResource: false, wipLimit: 3 },
  { id: "p-kitti", name: "กิตติ ป.", role: "QA Engineer", company: "HarmonyX", level: "Mid", skills: ["Testing"], capacityHours: 40, isKeyResource: false, wipLimit: 3 },
  { id: "p-wanna", name: "วรรณา ท.", role: "Data Engineer", company: "Certogo", level: "Senior", skills: ["Python", "AWS"], capacityHours: 40, isKeyResource: false, wipLimit: 3 },
  { id: "p-pakorn", name: "ปกรณ์ ล.", role: "DevOps Engineer", company: "Axebee", level: "Mid", skills: ["AWS", "Kubernetes"], capacityHours: 40, isKeyResource: false, wipLimit: 3 },
];

export const SEED_PROJECTS: Project[] = [
  { id: "erp", name: "ระบบ ERP กลุ่มบริษัท", client: "ลูกค้าเอกชน", status: "Active", rank: 1, wsjf: { value: 20, timeCriticality: 13, riskReduction: 8, size: 8 } },
  { id: "crm", name: "CRM ภาครัฐ", client: "หน่วยงานรัฐ", status: "Active", rank: 2, wsjf: { value: 13, timeCriticality: 20, riskReduction: 5, size: 8 } },
  { id: "lms", name: "Certogo LMS v3", client: "บริษัทในเครือ", status: "Active", rank: 3, wsjf: { value: 13, timeCriticality: 8, riskReduction: 8, size: 8 } },
  { id: "lake", name: "Data Lakehouse", client: "Pipeline", status: "Pipeline", rank: 4, winProbability: 0.7, wsjf: { value: 13, timeCriticality: 8, riskReduction: 5, size: 5 } },
  { id: "ai", name: "AI Platform", client: "ลูกค้าเอกชน", status: "Active", rank: 5, rankNote: "สัญญามีค่าปรับ", wsjf: { value: 8, timeCriticality: 5, riskReduction: 5, size: 13 } },
  { id: "asm", name: "Axebee ASM", client: "บริษัทในเครือ", status: "Active", rank: 6, wsjf: { value: 5, timeCriticality: 5, riskReduction: 8, size: 8 } },
  { id: "km", name: "KM Engine", client: "หน่วยงานรัฐ", status: "On-hold", rank: 7, rankNote: "รอ TOR ฉบับแก้ไข", wsjf: { value: 5, timeCriticality: 3, riskReduction: 3, size: 8 } },
];

let n = 0;
const b = (
  personId: string | null,
  projectId: string,
  role: Booking["role"],
  hoursPerWeek: number,
  startWeek: number,
  endWeek: number,
  status: Booking["status"],
  extra: Partial<Booking> = {},
): Booking => ({
  id: `b-${++n}`,
  personId,
  projectId,
  role,
  skills: [],
  level: "Mid",
  hoursPerWeek,
  startWeek,
  endWeek,
  status,
  requestedBy: "ณัฐวุฒิ จ.",
  source: "seed",
  ...extra,
});

export const SEED_BOOKINGS: Booking[] = [
  b("p-anan", "crm", "Solution Architect", 24, 41, 48, "Confirmed"),
  b("p-anan", "ai", "Solution Architect", 16, 42, 46, "Confirmed"),
  b("p-anan", "km", "Solution Architect", 8, 43, 44, "Proposed"),
  b("p-pim", "erp", "Senior Developer", 40, 41, 43, "Confirmed"),
  b("p-pim", "erp", "Senior Developer", 32, 44, 45, "Confirmed"),
  b("p-pim", "lms", "Senior Developer", 24, 46, 48, "Confirmed"),
  b("p-chayapol", "ai", "Solution Architect", 24, 41, 48, "Confirmed"),
  b("p-malee", "crm", "Developer", 20, 41, 48, "Confirmed"),
  b("p-thanakorn", "crm", "Developer", 16, 41, 48, "Confirmed"),
  b("p-thanakorn", "ai", "Developer", 24, 45, 48, "Proposed"),
  b("p-siriporn", "crm", "UX/UI Designer", 24, 41, 43, "Confirmed"),
  b("p-siriporn", "erp", "UX/UI Designer", 20, 41, 41, "Proposed"),
  b("p-kitti", "crm", "QA Engineer", 16, 41, 48, "Confirmed"),
  b("p-kitti", "erp", "QA Engineer", 16, 41, 48, "Confirmed"),
  b("p-wanna", "lms", "Data Engineer", 12, 41, 48, "Confirmed"),
  b("p-wanna", "lake", "Data Engineer", 40, 45, 46, "Proposed"),
  b("p-pakorn", "asm", "DevOps Engineer", 28, 41, 44, "Confirmed"),
  b("p-pakorn", "asm", "DevOps Engineer", 16, 45, 48, "Confirmed"),
  b(null, "ai", "Senior Developer", 40, 44, 48, "Requested", { level: "Senior", skills: ["React", "Node"], note: "เร่ง feature ก่อน UAT" }),
  b(null, "ai", "Data Engineer", 32, 45, 48, "Requested", { level: "Senior", skills: ["Python", "AWS"] }),
];
