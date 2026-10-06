import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { bookings, holidays, people, projects, tenants, users } from "../db/schema";

/**
 * Sample data for local development and demos only, matching the approved prototype.
 * Names are fictional. Real people and projects arrive through the R0 import.
 */
export const DEMO_TENANT = "HarmonyX (demo)";

const PEOPLE = [
  { key: "anan", name: "อนันต์ ส.", role: "Solution Architect", company: "HarmonyX", level: "Senior", skills: ["Integration", "AWS", "Architecture"], isKeyResource: true, wipLimit: 2 },
  { key: "pim", name: "พิมพ์ชนก ร.", role: "Senior Developer", company: "HarmonyX", level: "Senior", skills: ["React", "Node"], isKeyResource: true, wipLimit: 2 },
  { key: "chayapol", name: "ชยพล ก.", role: "Solution Architect", company: "HarmonyX", level: "Senior", skills: ["Integration", "AWS"], isKeyResource: false, wipLimit: 3 },
  { key: "malee", name: "มาลี ร.", role: "Developer", company: "HarmonyX", level: "Mid", skills: ["Integration", "Node"], isKeyResource: false, wipLimit: 3 },
  { key: "thanakorn", name: "ธนกร ว.", role: "Developer", company: "HarmonyX", level: "Mid", skills: ["React", "Node"], isKeyResource: false, wipLimit: 3 },
  { key: "siriporn", name: "ศิริพร ม.", role: "UX/UI Designer", company: "HarmonyX", level: "Mid", skills: ["Figma"], isKeyResource: false, wipLimit: 3 },
  { key: "kitti", name: "กิตติ ป.", role: "QA Engineer", company: "HarmonyX", level: "Mid", skills: ["Testing"], isKeyResource: false, wipLimit: 3 },
  { key: "wanna", name: "วรรณา ท.", role: "Data Engineer", company: "Certogo", level: "Senior", skills: ["Python", "AWS"], isKeyResource: false, wipLimit: 3 },
  { key: "pakorn", name: "ปกรณ์ ล.", role: "DevOps Engineer", company: "Axebee", level: "Mid", skills: ["AWS", "Kubernetes"], isKeyResource: false, wipLimit: 3 },
] as const;

const USERS = [
  { email: "pm@demo.harmonyx.co", name: "ณัฐวุฒิ จ.", role: "PM" },
  { email: "rm@demo.harmonyx.co", name: "สมศักดิ์ ท.", role: "RM" },
  { email: "council@demo.harmonyx.co", name: "ประธาน Council", role: "Council" },
  { email: "exec@demo.harmonyx.co", name: "ผู้บริหาร", role: "Executive" },
] as const;

const PROJECTS = [
  { key: "erp", name: "ระบบ ERP กลุ่มบริษัท", client: "ลูกค้าเอกชน", status: "Active", wsjf: [20, 13, 8, 8] },
  { key: "crm", name: "CRM ภาครัฐ", client: "หน่วยงานรัฐ", status: "Active", wsjf: [13, 20, 5, 8], owned: true },
  { key: "lms", name: "Certogo LMS v3", client: "บริษัทในเครือ", status: "Active", wsjf: [13, 8, 8, 8] },
  { key: "lake", name: "Data Lakehouse", client: "Pipeline", status: "Pipeline", wsjf: [13, 8, 5, 5], winProbability: "0.7" },
  { key: "ai", name: "AI Platform", client: "ลูกค้าเอกชน", status: "Active", wsjf: [8, 5, 5, 13], rankNote: "สัญญามีค่าปรับ" },
  { key: "asm", name: "Axebee ASM", client: "บริษัทในเครือ", status: "Active", wsjf: [5, 5, 8, 8] },
  { key: "km", name: "KM Engine", client: "หน่วยงานรัฐ", status: "On-hold", wsjf: [5, 3, 3, 8], rankNote: "รอ TOR ฉบับแก้ไข" },
] as const;

type B = [person: string | null, project: string, role: string, hours: number, start: number, end: number, status: "Requested" | "Proposed" | "Confirmed", extra?: { level?: string; skills?: string[]; note?: string }];
const BOOKINGS: B[] = [
  ["anan", "crm", "Solution Architect", 24, 202641, 202648, "Confirmed"],
  ["anan", "ai", "Solution Architect", 16, 202642, 202646, "Confirmed"],
  ["anan", "km", "Solution Architect", 8, 202643, 202644, "Proposed"],
  ["pim", "erp", "Senior Developer", 40, 202641, 202643, "Confirmed"],
  ["pim", "erp", "Senior Developer", 32, 202644, 202645, "Confirmed"],
  ["pim", "lms", "Senior Developer", 24, 202646, 202648, "Confirmed"],
  ["chayapol", "ai", "Solution Architect", 24, 202641, 202648, "Confirmed"],
  ["malee", "crm", "Developer", 20, 202641, 202648, "Confirmed"],
  ["thanakorn", "crm", "Developer", 16, 202641, 202648, "Confirmed"],
  ["thanakorn", "ai", "Developer", 24, 202645, 202648, "Proposed"],
  ["siriporn", "crm", "UX/UI Designer", 24, 202641, 202643, "Confirmed"],
  ["siriporn", "erp", "UX/UI Designer", 20, 202641, 202641, "Proposed"],
  ["kitti", "crm", "QA Engineer", 16, 202641, 202648, "Confirmed"],
  ["kitti", "erp", "QA Engineer", 16, 202641, 202648, "Confirmed"],
  ["wanna", "lms", "Data Engineer", 12, 202641, 202648, "Confirmed"],
  ["wanna", "lake", "Data Engineer", 40, 202645, 202646, "Proposed"],
  ["pakorn", "asm", "DevOps Engineer", 28, 202641, 202644, "Confirmed"],
  ["pakorn", "asm", "DevOps Engineer", 16, 202645, 202648, "Confirmed"],
  [null, "ai", "Senior Developer", 40, 202644, 202648, "Requested", { level: "Senior", skills: ["React", "Node"], note: "เร่ง feature ก่อน UAT" }],
  [null, "ai", "Data Engineer", 32, 202645, 202648, "Requested", { level: "Senior", skills: ["Python", "AWS"] }],
];

/** Sample Thai public holidays for the demo window. Replace with the HR calendar in R0. */
const HOLIDAYS = [
  { date: "2026-10-13", name: "วันนวมินทรมหาราช" },
  { date: "2026-10-23", name: "วันปิยมหาราช" },
  { date: "2026-12-07", name: "ชดเชยวันพ่อแห่งชาติ" },
  { date: "2026-12-10", name: "วันรัฐธรรมนูญ" },
  { date: "2026-12-31", name: "วันสิ้นปี" },
];

/** Idempotent: returns the existing demo tenant if it is already there. */
export async function seedDemo(db: Db): Promise<string> {
  const [existing] = await db.select().from(tenants).where(eq(tenants.name, DEMO_TENANT));
  if (existing) return existing.id;

  return db.transaction(async (tx) => {
    const [t] = await tx.insert(tenants).values({ name: DEMO_TENANT }).returning();
    const personIds = new Map<string, string>();
    for (const p of PEOPLE) {
      const { key, ...row } = p;
      const [r] = await tx.insert(people).values({ ...row, skills: [...row.skills], tenantId: t.id }).returning();
      personIds.set(key, r.id);
    }
    const userIds = new Map<string, string>();
    for (const u of USERS) {
      const [r] = await tx.insert(users).values({ ...u, tenantId: t.id }).returning();
      userIds.set(u.role, r.id);
    }
    const projectIds = new Map<string, string>();
    for (const [i, p] of PROJECTS.entries()) {
      const [value, timeCriticality, riskReduction, size] = p.wsjf;
      const [r] = await tx
        .insert(projects)
        .values({
          tenantId: t.id,
          name: p.name,
          client: p.client,
          status: p.status,
          rank: i + 1,
          wsjf: { value, timeCriticality, riskReduction, size },
          winProbability: "winProbability" in p ? p.winProbability : null,
          rankNote: "rankNote" in p ? p.rankNote : null,
          ownerUserId: "owned" in p ? userIds.get("PM") : null,
        })
        .returning();
      projectIds.set(p.key, r.id);
    }
    await tx.insert(bookings).values(
      BOOKINGS.map(([person, project, role, hoursPerWeek, startWeek, endWeek, status, extra]) => ({
        tenantId: t.id,
        projectId: projectIds.get(project)!,
        personId: person ? personIds.get(person)! : null,
        role,
        level: extra?.level ?? "Mid",
        skills: extra?.skills ?? [],
        hoursPerWeek,
        startWeek,
        endWeek,
        status,
        requestedBy: USERS[0].name,
        note: extra?.note ?? null,
        source: "seed" as const,
      })),
    );
    await tx.insert(holidays).values(HOLIDAYS.map((h) => ({ ...h, tenantId: t.id })));
    return t.id;
  });
}
