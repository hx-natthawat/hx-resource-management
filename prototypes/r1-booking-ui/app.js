// PROTOTYPE (#18). Three structurally different R1 screens over the same pure rules.
// A = Resource Manager console (heatmap first), B = booking pipeline (kanban), C = Council inbox (conflicts first).
// All state is in memory. Every action goes through ../r1-booking-logic/logic.ts.
import * as L from "../r1-booking-logic/logic.ts";
import { base, scenarios } from "../r1-booking-logic/scenarios.ts";

const VARIANTS = [
  { k: "A", name: "RM console: heatmap first" },
  { k: "B", name: "Booking pipeline: kanban" },
  { k: "C", name: "Council inbox: conflicts first" },
];
const app = document.getElementById("app");
let state = base();
const history = [];
let toast = "";
const ui = { sel: null, cand: null, demandOpen: false };

const variant = () => {
  const v = new URLSearchParams(location.search).get("variant") ?? "A";
  return VARIANTS.some((x) => x.k === v) ? v : "A";
};
const setVariant = (k) => {
  const u = new URL(location.href); u.searchParams.set("variant", k); window.history.replaceState(null, "", u); render();
};

function act(fn, input) {
  const r = fn(state, input);
  if (r.error) { toast = r.error; render(); return false; }
  history.push(state); state = r.state; toast = ""; render(); return true;
}

// ---------- shared helpers ----------
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const proj = (s, id) => L.project(s, id);
const chip = (s, id) => `<span class="chip ${id}">#${proj(s, id).rank} ${esc(proj(s, id).name)}</span>`;
const pname = (s, id) => (id ? L.person(s, id).name : "—");
const weeksTxt = (ws) => (ws.length > 1 && ws.at(-1) - ws[0] === ws.length - 1 ? `W${ws[0]}–W${ws.at(-1)}` : ws.map((w) => `W${w}`).join(", "));
const cell = (s, pid, w) => {
  const cap = L.capacity(s, pid, w), hard = L.hardHours(s, pid, w), soft = L.softHours(s, pid, w);
  const pct = cap === 0 ? (hard ? 999 : 0) : Math.round((hard / cap) * 100);
  return { cap, hard, soft, pct, lvl: pct > 100 ? "l3" : pct >= 80 ? "l2" : pct > 0 ? "l1" : "" };
};
const maxPct = (s, pid, ws) => Math.max(0, ...ws.map((w) => cell(s, pid, w).pct));
const openConflictsFor = (s, pid, w) => s.conflicts.some((c) => c.open && c.personId === pid && c.weeks.includes(w));
const colorOf = (pct) => (pct > 100 ? "var(--bad)" : pct >= 80 ? "var(--warn)" : "var(--ok)");

// Simulate propose + confirm without touching real state: the impact preview.
function simulate(bookingId, personId) {
  const b = L.booking(state, bookingId);
  if (!b || !personId) return null;
  let s = state;
  if (b.status === "Requested") {
    const r = L.propose(s, { bookingId, personId });
    if (r.error) return { error: r.error };
    s = r.state;
  } else if (b.status !== "Proposed" || b.personId !== personId) return null;
  const before = s;
  const r = L.confirm(s, { bookingId });
  if (r.error) return { error: r.error };
  const nb = L.booking(r.state, bookingId);
  const kind = nb.status === "Confirmed" ? (r.state.conflicts.length > before.conflicts.length ? "preempt" : "ok") : "block";
  return { state: r.state, kind, msg: r.state.log.at(-1) };
}

function header() {
  const s = state;
  return `
  <header class="top">
    <h1>HX Resource Management</h1><span class="tag">PROTOTYPE · in-memory · #18</span>
    <span class="spacer"></span>
    <select data-on="scenario"><option value="">Load scenario…</option>
      ${Object.entries(scenarios).map(([k, v]) => `<option value="${k}">${k}. ${esc(v.title)}</option>`).join("")}
    </select>
    <button data-act="demand-toggle" class="primary">+ New demand</button>
    <button data-act="undo" ${history.length ? "" : "disabled"}>Undo</button>
    <button data-act="reset">Reset</button>
  </header>
  ${ui.demandOpen ? demandForm(s) : ""}
  ${toast ? `<div class="toast">${esc(toast)}</div>` : ""}
  <div class="lastlog mono">${esc(s.log.at(-1) ?? "")}</div>`;
}

function demandForm(s) {
  const roles = [...new Set(s.people.map((p) => p.role))];
  const wk = s.weeks.map((w) => `<option>${w}</option>`).join("");
  return `<form class="demand-form" data-form="demand">
    <label>Project<select name="projectId">${s.projects.slice().sort((a, z) => a.rank - z.rank)
      .map((p) => `<option value="${p.id}">#${p.rank} ${esc(p.name)}</option>`).join("")}</select></label>
    <label>Role<select name="role">${roles.map((r) => `<option>${r}</option>`).join("")}</select></label>
    <label>Hours / week<input name="hours" type="number" value="16" min="1" max="60" style="width:80px"></label>
    <label>From week<select name="from">${wk}</select></label>
    <label>To week<select name="to">${wk}</select></label>
    <button class="primary">Raise demand</button>
    <span class="muted small">PM asks for a role, never a named person (ADR-002)</span>
  </form>`;
}

// ---------- Variant A: RM console, heatmap first ----------
function variantA() {
  const s = state;
  const queue = s.bookings.filter((b) => b.status === "Requested" || b.status === "Proposed");
  const sel = ui.sel ? L.booking(s, ui.sel) : null;
  if (sel && !(sel.status === "Requested" || sel.status === "Proposed")) ui.sel = null;
  const cand = ui.sel ? (ui.cand ?? (sel.status === "Proposed" ? sel.personId : null)) : null;
  const sim = ui.sel && cand ? simulate(ui.sel, cand) : null;
  const view = sim && sim.state ? sim.state : s;

  const rows = s.people.map((p) => {
    const roleMatch = sel && p.role === sel.role;
    return `<tr class="${sel ? "pick" : ""} ${cand === p.id ? "cand" : ""}" ${sel ? `data-act="cand" data-id="${p.id}"` : ""}>
      <td class="who">${esc(p.name)}${p.key ? " ★" : ""} <span class="muted small">${p.role} · ${p.capH}h</span>
        ${sel && roleMatch ? `<span class="small" style="color:var(--accent)"> match</span>` : ""}</td>
      ${s.weeks.map((w) => {
        const c = cell(cand === p.id ? view : s, p.id, w);
        const inweek = sel && cand === p.id && sel.weeks.includes(w);
        return `<td><div class="hc ${c.lvl} ${inweek ? "inweek" : ""}" title="${c.hard}h hard / ${c.cap}h capacity, ${c.soft}h soft">
          ${openConflictsFor(s, p.id, w) ? `<span class="dot"></span>` : ""}
          <b>${c.pct}%</b>${c.soft ? `<span class="muted">+${c.soft}h soft</span>` : `<span class="muted">${c.hard}/${c.cap}h</span>`}
        </div></td>`;
      }).join("")}
    </tr>`;
  }).join("");

  const impact = !sel ? `<p class="muted small">Pick a request on the right, then click a person in the heatmap to preview the impact.</p>`
    : !cand ? `<div class="impact">Click a person row to preview what confirming them would do.</div>`
    : sim?.error ? `<div class="impact block">${esc(sim.error)}</div>`
    : sim ? `<div class="impact ${sim.kind === "ok" ? "" : sim.kind}">
        <b>${sim.kind === "ok" ? "Fits." : sim.kind === "preempt" ? "Fits by taking hours from a lower-ranked project." : "Blocked."}</b>
        <div class="small" style="margin-top:4px">${esc(sim.msg)}</div></div>` : "";

  const acts = !sel ? "" : `<div style="display:flex;gap:8px;margin-top:10px">
    ${sel.status === "Requested" ? `<button data-act="propose" ${cand ? "" : "disabled"}>Propose ${cand ? esc(pname(s, cand)) : ""} (soft)</button>` : ""}
    <button class="primary" data-act="confirmA" ${cand ? "" : "disabled"}>Confirm (hard)</button>
    <button class="danger" data-act="release" data-id="${sel.id}">Release</button></div>`;

  return `<div class="va">
    <section class="panel"><h2>Capacity heatmap · hard % of weekly capacity</h2>
      <div class="scroll"><table class="heat"><tr><th class="who">Person</th>${s.weeks.map((w) => `<th>W${w}${s.holidays[w] ? ` <span class="muted">−${s.holidays[w]}h</span>` : ""}</th>`).join("")}</tr>${rows}</table></div>
      <p class="muted small">★ Key Resource (max 2 projects at once) · red dot = open conflict · dashed = weeks of the selected request</p>
      ${s.conflicts.filter((c) => c.open).map((c) => `<div class="small" style="color:var(--bad)">● ${c.id} ${c.rule} · ${esc(pname(s, c.personId))} ${weeksTxt(c.weeks)}</div>`).join("")}
    </section>
    <aside class="panel"><h2>Requests waiting for a person (${queue.length})</h2>
      ${queue.length ? queue.map((b) => `<div class="req ${ui.sel === b.id ? "sel" : ""}" data-act="sel" data-id="${b.id}">
        <div class="row">${chip(s, b.projectId)}<span class="st ${b.status}">${b.status}</span></div>
        <div style="margin-top:6px">${b.role} · <b>${b.hours}h</b>/wk · ${weeksTxt(b.weeks)}</div>
        <div class="muted small">${b.id}${b.personId ? ` · proposed ${esc(pname(s, b.personId))}` : ""}</div></div>`).join("")
        : `<p class="muted">No open requests. Raise a demand or load a scenario.</p>`}
      ${impact}${acts}
    </aside></div>`;
}

// ---------- Variant B: booking pipeline, kanban ----------
function variantB() {
  const s = state;
  const cols = ["Requested", "Proposed", "Confirmed", "Released"];
  const open = s.conflicts.filter((c) => c.open);
  const card = (b) => {
    const blocked = open.some((c) => c.challengerId === b.id);
    const load = b.personId ? maxPct(s, b.personId, b.weeks) : 0;
    const people = s.people.filter((p) => p.role === b.role).concat(s.people.filter((p) => p.role !== b.role));
    return `<div class="card ${blocked ? "blocked" : ""}">
      <div class="line">${chip(s, b.projectId)}<span class="muted small mono">${b.id}</span></div>
      <div>${b.role} · <b>${b.hours}h</b>/wk · ${weeksTxt(b.weeks)}</div>
      ${b.personId ? `<div class="small" style="margin-top:6px">${esc(pname(s, b.personId))} · peak ${load}% hard
        <div class="load"><i style="width:${Math.min(100, load)}%;background:${colorOf(load)}"></i></div></div>` : ""}
      ${blocked ? `<div class="small" style="color:var(--bad);margin-top:6px">Blocked by a conflict. See the banner.</div>` : ""}
      <div class="acts">
        ${b.status === "Requested" ? `<select data-pick="${b.id}">${people.map((p) => `<option value="${p.id}">${esc(p.name)} · ${p.role} · ${maxPct(s, p.id, b.weeks)}%</option>`).join("")}</select>
          <button data-act="proposeB" data-id="${b.id}">Propose</button>` : ""}
        ${b.status === "Proposed" ? `<button class="primary" data-act="confirm" data-id="${b.id}">Confirm</button>` : ""}
        ${b.status !== "Released" ? `<button class="danger" data-act="release" data-id="${b.id}">Release</button>` : ""}
      </div></div>`;
  };
  return `${open.map((c) => `<div class="banner"><b>${c.id} · ${c.rule}</b>
      <span>${esc(pname(s, c.personId))} over capacity in ${weeksTxt(c.weeks)}.
      ${c.challengerId ? `${c.challengerId} is waiting${c.winner ? `, rank says ${esc(proj(s, c.winner).name)} keeps the person` : ""}.` : "Nobody is waiting; a human must cut hours."}</span>
      ${c.challengerId ? `<input data-reason="${c.id}" placeholder="Council reason for an exception">
        <button data-act="council" data-id="${c.id}">Grant exception</button>` : ""}</div>`).join("")}
    <div class="kanban">${cols.map((st) => {
      const list = s.bookings.filter((b) => b.status === st);
      return `<div class="col"><h3><span class="st ${st}">${st}${st === "Proposed" ? " · soft" : st === "Confirmed" ? " · hard" : ""}</span><span class="muted">${list.length}</span></h3>
        ${list.map(card).join("") || `<p class="muted small">Empty</p>`}</div>`;
    }).join("")}</div>`;
}

// ---------- Variant C: Council inbox, conflicts first ----------
function variantC() {
  const s = state;
  const ranked = s.projects.slice().sort((a, z) => a.rank - z.rank);
  const conflicts = s.conflicts.slice().sort((a, z) => Number(z.open) - Number(a.open));
  const strip = (c) => {
    const ws = [...new Set([...c.weeks, ...c.weeks])].sort((a, z) => a - z);
    return `<div class="strip">${ws.map((w) => {
      const cap = L.capacity(s, c.personId, w);
      const scale = Math.max(cap, L.hardHours(s, c.personId, w), 1) * 1.25;
      const held = s.bookings.filter((b) => b.status === "Confirmed" && b.personId === c.personId && b.weeks.includes(w));
      const ch = c.challengerId ? L.booking(s, c.challengerId) : null;
      const segs = held.map((b) => `<i title="${b.id} ${proj(s, b.projectId).name} ${b.hours}h" style="width:${(b.hours / scale) * 100}%;background:var(--${b.projectId})"></i>`).join("")
        + (ch && ch.status === "Proposed" && ch.weeks.includes(w) ? `<i title="${ch.id} waiting ${ch.hours}h" style="width:${(ch.hours / scale) * 100}%;background:repeating-linear-gradient(45deg,var(--${ch.projectId}) 0 4px,transparent 4px 8px)"></i>` : "");
      return `<div class="wk"><span class="mono">W${w}</span><div class="bar">${segs}<span class="cap" style="left:${(cap / scale) * 100}%"></span></div>
        <span class="mono small">${L.hardHours(s, c.personId, w)}/${cap}h</span></div>`;
    }).join("")}</div>`;
  };
  const verdict = (c) => !c.open ? `Closed · ${c.rule}${c.winner ? ` · ${esc(proj(s, c.winner).name)} kept the person` : ""}${c.reason ? ` · “${esc(c.reason)}”` : ""}`
    : c.rule === "rank" ? `Rule ADR-003: ${esc(proj(s, c.winner).name)} (rank ${proj(s, c.winner).rank}) keeps ${esc(pname(s, c.personId))}. ${c.challengerId} waits unless the Council grants an exception.`
    : c.rule === "wip" ? `Rule ADR-004: ${esc(pname(s, c.personId))} is a Key Resource and would be on more than 2 projects.`
    : `Holiday cut capacity. No rule decides who loses hours (gap found by the prototype).`;
  return `<div class="vc">
    <aside class="panel rank"><h2>Portfolio Rank · this month</h2><ol>
      ${ranked.map((p, i) => `<li><span class="n">${p.rank}</span><span class="grow"><span class="chip ${p.id}">${esc(p.name)}</span></span>
        <button data-act="rank" data-id="${p.id}" data-to="${p.rank - 1}" ${i === 0 ? "disabled" : ""}>↑</button>
        <button data-act="rank" data-id="${p.id}" data-to="${p.rank + 1}" ${i === ranked.length - 1 ? "disabled" : ""}>↓</button></li>`).join("")}
      </ol><p class="muted small">No ties. Moving one swaps with its neighbour (ADR-003).</p>
      <h2 style="margin-top:18px">Holiday</h2>
      <form data-form="holiday" style="display:flex;gap:6px;align-items:center">
        <select name="week">${s.weeks.map((w) => `<option>${w}</option>`).join("")}</select>
        <input name="hours" type="number" value="16" style="width:70px"> h off <button>Apply</button></form>
    </aside>
    <section class="inbox"><h2 class="muted" style="font-size:13px;text-transform:uppercase;letter-spacing:.04em">Council inbox · ${s.conflicts.filter((c) => c.open).length} open</h2>
      ${conflicts.length ? conflicts.map((c) => `<div class="item ${c.open ? "open" : "closed"}">
        <div class="head"><b>${esc(pname(s, c.personId))} · ${weeksTxt(c.weeks)}</b><span class="muted small mono">${c.id} · ${c.rule}</span></div>
        <div class="small muted">${[c.challengerId, ...c.holderIds].filter(Boolean).map((id) => { const b = L.booking(s, id); return `${id} ${proj(s, b.projectId).name} ${b.hours}h ${b.status}`; }).join(" · ")}</div>
        ${strip(c)}
        <div class="verdict small">${verdict(c)}</div>
        ${c.open ? `<div class="decide">
          ${c.challengerId ? `<input data-reason="${c.id}" placeholder="Reason for an exception (required)"><button class="primary" data-act="council" data-id="${c.id}">Grant exception</button>
            <button data-act="release" data-id="${c.challengerId}">Keep rank · release ${c.challengerId}</button>`
            : c.holderIds.map((id) => `<button data-act="release" data-id="${id}">Release ${id} (${proj(s, L.booking(s, id).projectId).name})</button>`).join("")}
        </div>` : ""}</div>`).join("")
        : `<div class="item"><p class="muted">No conflicts. Load scenario 1, 2, 3, 4 or 5 from the top bar.</p></div>`}
    </section></div>`;
}

function switcher() {
  const v = variant(), i = VARIANTS.findIndex((x) => x.k === v);
  return `<div class="switcher"><button data-act="var" data-to="${VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length].k}">←</button>
    <span>${v} — ${VARIANTS[i].name}</span>
    <button data-act="var" data-to="${VARIANTS[(i + 1) % VARIANTS.length].k}">→</button></div>`;
}

function render() {
  const v = variant();
  app.innerHTML = header() + `<main>${v === "A" ? variantA() : v === "B" ? variantB() : variantC()}</main>` + switcher();
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const id = t.dataset.id;
  switch (t.dataset.act) {
    case "var": setVariant(t.dataset.to); break;
    case "undo": state = history.pop() ?? state; toast = ""; render(); break;
    case "reset": history.push(state); state = base(); ui.sel = ui.cand = null; toast = ""; render(); break;
    case "demand-toggle": ui.demandOpen = !ui.demandOpen; render(); break;
    case "sel": ui.sel = ui.sel === id ? null : id; ui.cand = null; render(); break;
    case "cand": ui.cand = id; render(); break;
    case "propose": act(L.propose, { bookingId: ui.sel, personId: ui.cand }); break;
    case "confirmA": {
      const b = L.booking(state, ui.sel);
      if (b.status === "Requested" && !act(L.propose, { bookingId: b.id, personId: ui.cand })) break;
      act(L.confirm, { bookingId: b.id }); ui.cand = null; render(); break;
    }
    case "proposeB": act(L.propose, { bookingId: id, personId: document.querySelector(`[data-pick="${id}"]`).value }); break;
    case "confirm": act(L.confirm, { bookingId: id }); break;
    case "release": act(L.release, { bookingId: id }); break;
    case "council": act(L.councilException, { conflictId: id, reason: document.querySelector(`[data-reason="${id}"]`)?.value ?? "" }); break;
    case "rank": act(L.rerank, { projectId: id, rank: Number(t.dataset.to) }); break;
  }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.on === "scenario" && e.target.value) {
    history.push(state); state = scenarios[e.target.value].build(); ui.sel = ui.cand = null; toast = ""; render();
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  if (e.target.dataset.form === "demand") {
    const from = Number(f.get("from")), to = Number(f.get("to"));
    const weeks = Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
    act(L.raiseDemand, { projectId: f.get("projectId"), role: f.get("role"), hours: Number(f.get("hours")), weeks });
  }
  if (e.target.dataset.form === "holiday") act(L.setHoliday, { week: Number(f.get("week")), hours: Number(f.get("hours")) });
});
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select, [contenteditable]")) return;
  const i = VARIANTS.findIndex((x) => x.k === variant());
  if (e.key === "ArrowRight") setVariant(VARIANTS[(i + 1) % VARIANTS.length].k);
  if (e.key === "ArrowLeft") setVariant(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length].k);
});

render();
