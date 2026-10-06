// PROTOTYPE (#18). Throwaway terminal shell over logic.ts. Run: pnpm prototype:booking
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import * as L from "./logic.ts";
import { base, scenarios } from "./scenarios.ts";

const B = (t: string) => `\x1b[1m${t}\x1b[0m`;
const D = (t: string) => `\x1b[2m${t}\x1b[0m`;
const C = (n: number, t: string) => `\x1b[${n}m${t}\x1b[0m`;

let state: L.State = base();
const history: L.State[] = [];
let flash = "";

function cell(s: L.State, pid: string, w: number): string {
  const cap = L.capacity(s, pid, w), hard = L.hardHours(s, pid, w), soft = L.softHours(s, pid, w);
  const pct = cap === 0 ? (hard > 0 ? 999 : 0) : Math.round((hard / cap) * 100);
  const txt = `${String(pct).padStart(3)}%` + (soft ? `+${soft}s` : "   ").padEnd(5);
  const color = pct > 100 ? 41 : pct >= 80 ? 43 : pct > 0 ? 42 : 0;
  return color ? C(color, C(30, txt)) : D(txt);
}

function render() {
  const s = state;
  const out: string[] = [];
  out.push(B("HX-RMS booking prototype") + D("  (#18, throwaway, in-memory)"));
  out.push("");
  out.push(B("Projects  ") + s.projects.slice().sort((a, z) => a.rank - z.rank)
    .map((p) => `${p.rank}. ${p.id} ${D(p.name)}`).join("   "));
  out.push("");
  out.push(B("Heatmap ") + D("hard % of capacity, +Ns = soft hours") +
    (Object.keys(s.holidays).length ? D("   holidays: " + Object.entries(s.holidays).map(([w, h]) => `W${w}-${h}h`).join(" ")) : ""));
  out.push("          " + s.weeks.map((w) => B(`W${w}`.padEnd(10))).join(""));
  for (const p of s.people)
    out.push(`${(p.id + (p.key ? "*" : "")).padEnd(6)}${D(String(p.capH).padStart(2) + "h")}  ` +
      s.weeks.map((w) => cell(s, p.id, w) + " ").join(""));
  out.push(D("        * = Key Resource (WIP limit 2)"));
  out.push("");
  out.push(B("Bookings"));
  if (!s.bookings.length) out.push(D("  none"));
  for (const b of s.bookings) {
    const col = { Requested: 36, Proposed: 33, Confirmed: 32, Released: 2 }[b.status];
    out.push(`  ${b.id.padEnd(4)} ${b.projectId.padEnd(5)} ${b.role.padEnd(10)} ${String(b.hours).padStart(2)}h ` +
      `W${b.weeks.join(",W").padEnd(14)} ${C(col, b.status.padEnd(10))} ${b.personId ?? D("(no person)")}`);
  }
  out.push("");
  out.push(B("Conflicts"));
  if (!s.conflicts.length) out.push(D("  none"));
  for (const c of s.conflicts)
    out.push(`  ${c.id.padEnd(4)} ${(c.open ? C(31, "OPEN  ") : D("closed"))} ${c.rule.padEnd(13)} ${c.personId.padEnd(5)} ` +
      `W${c.weeks.join(",W")}  challenger=${c.challengerId ?? "-"} holders=${c.holderIds.join(",") || "-"}` +
      (c.winner ? `  winner=${c.winner}` : "") + (c.reason ? D(`  "${c.reason}"`) : ""));
  out.push("");
  out.push(B("Log ") + D("(last 8)"));
  for (const l of s.log.slice(-8)) out.push("  " + (l.startsWith("!") ? C(31, l) : l));
  if (flash) { out.push(""); out.push(C(31, "! " + flash)); }
  out.push("");
  out.push([["d", "demand"], ["p", "propose"], ["c", "confirm"], ["x", "release"], ["o", "council exception"],
    ["h", "holiday"], ["r", "rerank"], ["k", "toggle key"], ["u", "undo"], ["0", "reset"], ["q", "quit"]]
    .map(([k, d]) => `${B("[" + k + "]")} ${D(d)}`).join("  "));
  out.push(Object.entries(scenarios).map(([k, v]) => `${B("[" + k + "]")} ${D(v.title)}`).join("\n"));
  console.clear();
  console.log(out.join("\n"));
}

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = (q: string) => rl.question(D(q + ": "));
const weeksOf = (t: string) => t.includes("-")
  ? (([a, z]) => Array.from({ length: z - a + 1 }, (_, i) => a + i))(t.split("-").map(Number))
  : t.split(",").map(Number);

function apply(r: L.Result) {
  if (r.error) { flash = r.error; return; }
  history.push(state);
  state = r.state;
}

async function loop() {
  for (;;) {
    render();
    flash = "";
    const cmd = (await rl.question("> ")).trim();
    if (cmd === "q") break;
    if (cmd === "u") { state = history.pop() ?? state; continue; }
    if (cmd === "0") { history.push(state); state = base(); continue; }
    if (scenarios[cmd]) { history.push(state); state = scenarios[cmd].build(); continue; }
    switch (cmd) {
      case "d": apply(L.raiseDemand(state, { projectId: await ask("project (gov/bank/crm)"), role: await ask("role"),
        hours: Number(await ask("hours per week")), weeks: weeksOf(await ask("weeks e.g. 2-4 or 1,3")) })); break;
      case "p": apply(L.propose(state, { bookingId: await ask("booking id"), personId: await ask("person (nok/ton/ploy/beam)") })); break;
      case "c": apply(L.confirm(state, { bookingId: await ask("booking id") })); break;
      case "x": apply(L.release(state, { bookingId: await ask("booking id") })); break;
      case "o": apply(L.councilException(state, { conflictId: await ask("conflict id"), reason: await ask("reason") })); break;
      case "h": apply(L.setHoliday(state, { week: Number(await ask("week")), hours: Number(await ask("hours off")) })); break;
      case "r": apply(L.rerank(state, { projectId: await ask("project"), rank: Number(await ask("new rank")) })); break;
      case "k": apply(L.toggleKey(state, { personId: await ask("person") })); break;
      default: if (cmd) flash = `unknown command "${cmd}"`;
    }
  }
  rl.close();
}

loop();
