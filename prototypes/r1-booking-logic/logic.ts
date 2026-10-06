// PROTOTYPE (#18). Pure booking and conflict rules for R1. No I/O.
// Question: do ADR-002 (Demand → Soft → Hard), ADR-003 (rank wins, Council exception),
// ADR-004 (hours/week, WIP limit 2 for Key Resources) and ADR-006 (capacity check at confirm)
// hold together for races, rank preemption, holiday drops and Council exceptions?
// Every function is (state, input) => Result. The TUI is a thin shell over this file.

export type Status = "Requested" | "Proposed" | "Confirmed" | "Released";
// Draft is a UI-only state (an unsent form), so the model starts at Requested.

export type Person = { id: string; name: string; role: string; capH: number; key: boolean };
export type Project = { id: string; name: string; rank: number }; // rank 1 = highest priority
export type Booking = {
  id: string; projectId: string; role: string; hours: number; weeks: number[];
  personId: string | null; status: Status;
};
export type ConflictRule = "rank" | "council" | "wip" | "capacity-drop";
export type Conflict = {
  id: string; personId: string; weeks: number[]; challengerId: string | null; holderIds: string[];
  rule: ConflictRule; open: boolean; winner: string | null; reason: string | null;
};
export type State = {
  weeks: number[]; holidays: Record<number, number>;
  people: Person[]; projects: Project[]; bookings: Booking[]; conflicts: Conflict[];
  log: string[]; seq: number;
};
export type Result = { state: State; error?: string };

const WIP_LIMIT = 2;

const clone = (s: State): State => structuredClone(s);
const fail = (s: State, error: string): Result => ({ state: s, error });
const nextId = (s: State, p: string) => `${p}${++s.seq}`;
const say = (s: State, msg: string) => { s.log.push(msg); };

export const person = (s: State, id: string) => s.people.find((p) => p.id === id);
export const project = (s: State, id: string) => s.projects.find((p) => p.id === id);
export const booking = (s: State, id: string) => s.bookings.find((b) => b.id === id);

export function capacity(s: State, personId: string, week: number): number {
  const p = person(s, personId);
  if (!p) return 0;
  return Math.max(0, p.capH - (s.holidays[week] ?? 0));
}

const confirmedOn = (s: State, personId: string, week: number, exceptId?: string) =>
  s.bookings.filter((b) => b.status === "Confirmed" && b.personId === personId &&
    b.weeks.includes(week) && b.id !== exceptId);

export function hardHours(s: State, personId: string, week: number): number {
  return confirmedOn(s, personId, week).reduce((t, b) => t + b.hours, 0);
}

export function softHours(s: State, personId: string, week: number): number {
  return s.bookings.filter((b) => b.status === "Proposed" && b.personId === personId && b.weeks.includes(week))
    .reduce((t, b) => t + b.hours, 0);
}

// ADR-002: every request starts as a Demand by role and skill. Nobody books a named person here.
export function raiseDemand(s0: State, i: { projectId: string; role: string; hours: number; weeks: number[] }): Result {
  if (!project(s0, i.projectId)) return fail(s0, `no project ${i.projectId}`);
  if (!(i.hours > 0)) return fail(s0, "hours must be > 0");
  if (i.weeks.length === 0 || i.weeks.some((w) => !s0.weeks.includes(w))) return fail(s0, "weeks out of range");
  const s = clone(s0);
  const b: Booking = { id: nextId(s, "b"), projectId: i.projectId, role: i.role, hours: i.hours,
    weeks: [...i.weeks].sort((a, z) => a - z), personId: null, status: "Requested" };
  s.bookings.push(b);
  say(s, `${b.id} demand ${i.projectId} ${i.role} ${i.hours}h W${b.weeks.join(",W")} → Requested`);
  return { state: s };
}

// RM proposes a person (soft). Soft never consumes capacity.
export function propose(s0: State, i: { bookingId: string; personId: string }): Result {
  const b0 = booking(s0, i.bookingId);
  if (!b0) return fail(s0, `no booking ${i.bookingId}`);
  if (!person(s0, i.personId)) return fail(s0, `no person ${i.personId}`);
  if (b0.status !== "Requested") return fail(s0, `${b0.id} is ${b0.status}, propose needs Requested`);
  const s = clone(s0);
  const b = booking(s, i.bookingId)!;
  b.personId = i.personId; b.status = "Proposed";
  say(s, `${b.id} propose ${i.personId} → Proposed (soft)`);
  return { state: s };
}

function wipProjects(s: State, personId: string, weeks: number[], extraProjectId: string): string[] {
  const ids = new Set<string>([extraProjectId]);
  for (const b of s.bookings)
    if (b.status === "Confirmed" && b.personId === personId && b.weeks.some((w) => weeks.includes(w))) ids.add(b.projectId);
  return [...ids];
}

// Weeks where adding `hours` for this person would exceed capacity.
function overflowWeeks(s: State, b: Booking): number[] {
  return b.weeks.filter((w) => hardHours(s, b.personId!, w) + b.hours > capacity(s, b.personId!, w));
}

// Displace holders (lowest priority first) until the challenger fits. Displaced bookings go back
// to Requested with the person cleared, so their RM must find someone else.
function displaceFor(s: State, b: Booking, allowHigherRank: boolean): string[] | null {
  const myRank = project(s, b.projectId)!.rank;
  const displaced: string[] = [];
  for (;;) {
    const over = overflowWeeks(s, b);
    if (over.length === 0) return displaced;
    const holders = s.bookings
      .filter((h) => h.status === "Confirmed" && h.personId === b.personId && h.weeks.some((w) => over.includes(w)))
      .filter((h) => allowHigherRank || project(s, h.projectId)!.rank > myRank)
      .sort((a, z) => project(s, z.projectId)!.rank - project(s, a.projectId)!.rank);
    if (holders.length === 0) return null;
    const h = holders[0];
    h.status = "Requested"; h.personId = null;
    displaced.push(h.id);
  }
}

// ADR-006: the capacity check runs at confirm, inside what will be one transaction.
// ADR-003: if the person is full, the better-ranked project wins automatically.
export function confirm(s0: State, i: { bookingId: string }): Result {
  const b0 = booking(s0, i.bookingId);
  if (!b0) return fail(s0, `no booking ${i.bookingId}`);
  if (b0.status === "Confirmed") return { state: s0 }; // idempotent retry, same end state
  if (b0.status !== "Proposed") return fail(s0, `${b0.id} is ${b0.status}, confirm needs Proposed`);
  const s = clone(s0);
  const b = booking(s, i.bookingId)!;
  const p = person(s, b.personId!)!;

  if (p.key) {
    const projs = wipProjects(s, p.id, b.weeks, b.projectId);
    if (projs.length > WIP_LIMIT) {
      const c = openConflict(s, p.id, b.weeks, b.id, [], "wip");
      say(s, `${b.id} BLOCKED: ${p.id} is Key Resource, would be on ${projs.length} projects (limit ${WIP_LIMIT}) → ${c.id}`);
      return { state: s };
    }
  }

  const over = overflowWeeks(s, b);
  if (over.length === 0) {
    b.status = "Confirmed";
    say(s, `${b.id} confirm ${p.id} → Confirmed (hard)`);
    return { state: s };
  }

  const holderIds = s.bookings.filter((h) => h.status === "Confirmed" && h.personId === p.id &&
    h.weeks.some((w) => over.includes(w))).map((h) => h.id);
  const trial = clone(s);
  const displaced = displaceFor(trial, booking(trial, b.id)!, false);
  if (displaced) {
    trial.bookings.find((x) => x.id === b.id)!.status = "Confirmed";
    const c = openConflict(trial, p.id, over, b.id, holderIds, "rank");
    c.open = false; c.winner = b.projectId;
    say(trial, `${b.id} confirm ${p.id} over capacity W${over.join(",W")} → rank ${project(trial, b.projectId)!.rank} wins, ` +
      `displaced ${displaced.join(",")} back to Requested (${c.id})`);
    return { state: trial };
  }
  const c = openConflict(s, p.id, over, b.id, holderIds, "rank");
  c.winner = s.bookings.filter((h) => holderIds.includes(h.id))
    .map((h) => project(s, h.projectId)!).sort((a, z) => a.rank - z.rank)[0].id;
  say(s, `${b.id} BLOCKED: ${p.id} full W${over.join(",W")}, held by better rank → ${c.id} open, Council may grant exception`);
  return { state: s };
}

function openConflict(s: State, personId: string, weeks: number[], challengerId: string | null,
  holderIds: string[], rule: ConflictRule): Conflict {
  const c: Conflict = { id: nextId(s, "c"), personId, weeks, challengerId, holderIds, rule, open: true, winner: null, reason: null };
  s.conflicts.push(c);
  return c;
}

// ADR-003: an exception to rank needs the Resource Council and a written reason.
export function councilException(s0: State, i: { conflictId: string; reason: string }): Result {
  const c0 = s0.conflicts.find((c) => c.id === i.conflictId);
  if (!c0) return fail(s0, `no conflict ${i.conflictId}`);
  if (!c0.open) return fail(s0, `${c0.id} is already closed`);
  if (!i.reason.trim()) return fail(s0, "Council exception needs a reason");
  if (!c0.challengerId) return fail(s0, `${c0.id} has no challenger; release or re-plan a booking instead`);
  const s = clone(s0);
  const c = s.conflicts.find((x) => x.id === i.conflictId)!;
  const b = booking(s, c.challengerId!)!;
  if (b.status !== "Proposed") return fail(s0, `${b.id} is ${b.status}, nothing to grant`);
  let displaced: string[] = [];
  if (c.rule === "rank") {
    displaced = displaceFor(s, b, true) ?? [];
  }
  b.status = "Confirmed";
  c.open = false; c.rule = "council"; c.winner = b.projectId; c.reason = i.reason.trim();
  say(s, `${c.id} Council exception "${c.reason}" → ${b.id} Confirmed` +
    (displaced.length ? `, displaced ${displaced.join(",")} back to Requested` : " (WIP limit waived)"));
  return { state: s };
}

export function release(s0: State, i: { bookingId: string }): Result {
  const b0 = booking(s0, i.bookingId);
  if (!b0) return fail(s0, `no booking ${i.bookingId}`);
  if (b0.status === "Released") return { state: s0 };
  const s = clone(s0);
  const b = booking(s, i.bookingId)!;
  b.status = "Released";
  for (const c of s.conflicts) if (c.open && c.challengerId === b.id) { c.open = false; c.reason = "challenger released"; }
  for (const c of s.conflicts)
    if (c.open && c.rule === "capacity-drop" && c.weeks.every((w) => hardHours(s, c.personId, w) <= capacity(s, c.personId, w))) {
      c.open = false; c.reason = `resolved by releasing ${b.id}`;
    }
  say(s, `${b.id} → Released`);
  return { state: s };
}

// ADR-004: holidays cut capacity. Confirmed bookings already over the new capacity become
// capacity-drop conflicts. Nothing is displaced automatically; a human decides.
export function setHoliday(s0: State, i: { week: number; hours: number }): Result {
  if (!s0.weeks.includes(i.week)) return fail(s0, "week out of range");
  const s = clone(s0);
  s.holidays[i.week] = Math.max(0, i.hours);
  say(s, `holiday W${i.week} = ${i.hours}h off for everyone`);
  for (const p of s.people) {
    const used = hardHours(s, p.id, i.week), cap = capacity(s, p.id, i.week);
    const already = s.conflicts.some((c) => c.open && c.rule === "capacity-drop" && c.personId === p.id && c.weeks.includes(i.week));
    if (used > cap && !already) {
      const c = openConflict(s, p.id, [i.week], null, confirmedOn(s, p.id, i.week).map((b) => b.id), "capacity-drop");
      say(s, `${c.id} ${p.id} now ${used}/${cap}h in W${i.week} → open, needs a human`);
    }
  }
  return { state: s };
}

// ADR-003: rank is unique. Setting a rank swaps with whoever held it.
export function rerank(s0: State, i: { projectId: string; rank: number }): Result {
  const p0 = project(s0, i.projectId);
  if (!p0) return fail(s0, `no project ${i.projectId}`);
  if (i.rank < 1 || i.rank > s0.projects.length) return fail(s0, `rank must be 1..${s0.projects.length}`);
  const s = clone(s0);
  const p = project(s, i.projectId)!;
  const other = s.projects.find((x) => x.rank === i.rank)!;
  other.rank = p.rank; p.rank = i.rank;
  say(s, `rank ${p.id}=${p.rank}, ${other.id}=${other.rank} (swap, no ties)`);
  return { state: s };
}

export function toggleKey(s0: State, i: { personId: string }): Result {
  if (!person(s0, i.personId)) return fail(s0, `no person ${i.personId}`);
  const s = clone(s0);
  const p = person(s, i.personId)!;
  p.key = !p.key;
  say(s, `${p.id} Key Resource = ${p.key}`);
  return { state: s };
}
