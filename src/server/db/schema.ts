import { sql } from "drizzle-orm";
import { bigserial, boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const bookingStatus = pgEnum("booking_status", ["Draft", "Requested", "Proposed", "Confirmed", "Released", "Rejected"]);
export const bookingSource = pgEnum("booking_source", ["voice", "form", "seed"]);
export const decisionKind = pgEnum("decision_kind", ["shift", "substitute", "reduce"]);
export const appRole = pgEnum("app_role", ["PM", "RM", "Council", "Executive", "Admin"]);

const tenantId = () => uuid("tenant_id").notNull().references(() => tenants.id);
const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
});

export const people = pgTable(
  "people",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    company: text("company").notNull(),
    level: text("level").notNull(),
    skills: text("skills").array().notNull().default(sql`'{}'`),
    capacityHours: integer("capacity_hours").notNull().default(40),
    isKeyResource: boolean("is_key_resource").notNull().default(false),
    wipLimit: integer("wip_limit").notNull().default(3),
  },
  (t) => [index("people_tenant_idx").on(t.tenantId)],
);

/** Someone who signs in. Linked to a Person when they can also be booked. */
export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: tenantId(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: appRole("role").notNull(),
    personId: uuid("person_id").references(() => people.id),
    googleSub: text("google_sub"),
  },
  (t) => [uniqueIndex("users_tenant_email_uq").on(t.tenantId, t.email)],
);

/** Non-working days for the whole tenant. Each weekday holiday lowers weekly capacity by a fifth (ADR-004). */
export const holidays = pgTable(
  "holidays",
  {
    id: id(),
    tenantId: tenantId(),
    date: date("date", { mode: "string" }).notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("holidays_tenant_date_uq").on(t.tenantId, t.date)],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    client: text("client").notNull(),
    status: text("status").notNull(),
    rank: integer("rank").notNull(),
    wsjf: jsonb("wsjf").notNull(),
    winProbability: numeric("win_probability"),
    rankNote: text("rank_note"),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
  },
  (t) => [uniqueIndex("projects_tenant_rank_uq").on(t.tenantId, t.rank)],
);

/** Weeks are ISO year * 100 + ISO week (2026-W43 is 202643), so ranges compare across years. */
export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    tenantId: tenantId(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    personId: uuid("person_id").references(() => people.id),
    role: text("role").notNull(),
    level: text("level").notNull(),
    skills: text("skills").array().notNull().default(sql`'{}'`),
    hoursPerWeek: integer("hours_per_week").notNull(),
    startWeek: integer("start_week").notNull(),
    endWeek: integer("end_week").notNull(),
    status: bookingStatus("status").notNull(),
    requestedBy: text("requested_by").notNull(),
    note: text("note"),
    source: bookingSource("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bookings_person_weeks_idx").on(t.tenantId, t.personId, t.startWeek, t.endWeek)],
);

export const decisions = pgTable("decisions", {
  id: id(),
  tenantId: tenantId(),
  personId: uuid("person_id").notNull().references(() => people.id),
  weeks: integer("weeks").array().notNull(),
  kind: decisionKind("kind").notNull(),
  summary: text("summary").notNull(),
  followedRecommendation: boolean("followed_recommendation").notNull(),
  reason: text("reason").notNull(),
  decidedBy: text("decided_by").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only. A trigger in the migrations rejects UPDATE and DELETE (ADR-006). */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: tenantId(),
    actor: text("actor").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.tenantId, t.entity, t.entityId)],
);
