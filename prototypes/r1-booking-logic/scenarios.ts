// PROTOTYPE (#18). Seed states and scripted cases. Each scenario replays real actions through logic.ts.
import { type State, type Result, raiseDemand, propose, confirm, setHoliday } from "./logic.ts";

export function base(): State {
  return {
    weeks: [1, 2, 3, 4, 5, 6],
    holidays: {},
    people: [
      { id: "nok", name: "Nok", role: "architect", capH: 40, key: true },
      { id: "ton", name: "Ton", role: "dev", capH: 40, key: false },
      { id: "ploy", name: "Ploy", role: "dev", capH: 40, key: false },
      { id: "beam", name: "Beam", role: "qa", capH: 32, key: false },
    ],
    projects: [
      { id: "gov", name: "Gov Portal", rank: 1 },
      { id: "bank", name: "Bank App", rank: 2 },
      { id: "crm", name: "Internal CRM", rank: 3 },
    ],
    bookings: [], conflicts: [], log: ["fresh state: 4 people, 3 projects ranked gov=1 bank=2 crm=3"], seq: 0,
  };
}

type Step = (s: State) => Result;
function run(title: string, steps: Step[]): State {
  let s = base();
  s.log = [`SCENARIO ${title}`];
  for (const step of steps) {
    const r = step(s);
    if (r.error) r.state.log.push(`! ${r.error}`);
    s = r.state;
  }
  return s;
}

export const scenarios: Record<string, { title: string; build: () => State }> = {
  "1": { title: "Race: two RMs confirm Ton for the same weeks", build: () => run("race", [
    (s) => raiseDemand(s, { projectId: "bank", role: "dev", hours: 24, weeks: [2, 3] }),
    (s) => raiseDemand(s, { projectId: "crm", role: "dev", hours: 24, weeks: [2, 3] }),
    (s) => propose(s, { bookingId: "b1", personId: "ton" }),
    (s) => propose(s, { bookingId: "b2", personId: "ton" }),
    (s) => confirm(s, { bookingId: "b2" }),
    (s) => confirm(s, { bookingId: "b1" }),
  ]) },
  "2": { title: "Preemption: Gov (rank 1) needs Ploy who is held by CRM (rank 3)", build: () => run("preempt", [
    (s) => raiseDemand(s, { projectId: "crm", role: "dev", hours: 32, weeks: [1, 2, 3, 4] }),
    (s) => propose(s, { bookingId: "b1", personId: "ploy" }),
    (s) => confirm(s, { bookingId: "b1" }),
    (s) => raiseDemand(s, { projectId: "gov", role: "dev", hours: 24, weeks: [3, 4, 5] }),
    (s) => propose(s, { bookingId: "b2", personId: "ploy" }),
    (s) => confirm(s, { bookingId: "b2" }),
  ]) },
  "3": { title: "Holiday: W2 loses 16h after Beam is fully booked", build: () => run("holiday", [
    (s) => raiseDemand(s, { projectId: "bank", role: "qa", hours: 32, weeks: [1, 2, 3] }),
    (s) => propose(s, { bookingId: "b1", personId: "beam" }),
    (s) => confirm(s, { bookingId: "b1" }),
    (s) => setHoliday(s, { week: 2, hours: 16 }),
  ]) },
  "4": { title: "WIP: Nok (Key Resource) asked for a 3rd project", build: () => run("wip", [
    (s) => raiseDemand(s, { projectId: "gov", role: "architect", hours: 8, weeks: [1, 2] }),
    (s) => raiseDemand(s, { projectId: "bank", role: "architect", hours: 8, weeks: [2, 3] }),
    (s) => raiseDemand(s, { projectId: "crm", role: "architect", hours: 8, weeks: [2] }),
    (s) => propose(s, { bookingId: "b1", personId: "nok" }),
    (s) => propose(s, { bookingId: "b2", personId: "nok" }),
    (s) => propose(s, { bookingId: "b3", personId: "nok" }),
    (s) => confirm(s, { bookingId: "b1" }),
    (s) => confirm(s, { bookingId: "b2" }),
    (s) => confirm(s, { bookingId: "b3" }),
  ]) },
  "5": { title: "Blocked: CRM (rank 3) wants Ton, already full for Gov (rank 1)", build: () => run("blocked", [
    (s) => raiseDemand(s, { projectId: "gov", role: "dev", hours: 40, weeks: [1, 2] }),
    (s) => propose(s, { bookingId: "b1", personId: "ton" }),
    (s) => confirm(s, { bookingId: "b1" }),
    (s) => raiseDemand(s, { projectId: "crm", role: "dev", hours: 16, weeks: [2] }),
    (s) => propose(s, { bookingId: "b2", personId: "ton" }),
    (s) => confirm(s, { bookingId: "b2" }),
  ]) },
};
