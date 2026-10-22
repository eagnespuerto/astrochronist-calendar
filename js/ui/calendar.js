// Calendar tab: the Mars-calendar card layout for every system, with one-click conversion.
// The selection is an instant, so switching systems keeps it and jumps to the matching year.
import { SYSTEMS, byId, gregorian } from "../systems.js";
import { isoUTC } from "../time/core.js";
import { prefs, setPref, $, esc, radioButtons } from "./prefs.js";
import { calendarEvents, eventItem, plannerOnCalendar } from "./science.js";

const S = { sys: byId(prefs().calSys || "mars"), year: null, sel: Date.now(), at: null, msg: "" };
let cellMap = [];
let active = false;

const ROWS = () => [
  { name: "Your local time", f: ms => gregorian.label(ms) },
  { name: "UTC", f: ms => isoUTC(ms) },
  ...SYSTEMS.filter(s => s.id !== "greg").map(s => ({ id: s.id, name: s.name, f: ms => s.label(ms) })),
];

function render() {
  const sys = S.sys;
  if (S.year == null) S.year = sys.yearOf(S.sel ?? Date.now());
  S.year = sys.clampYear(S.year);
  document.body.dataset.sys = sys.id;
  const L = sys.layout(S.year);
  $("calTitle").textContent = sys.yearTitle(S.year);
  $("calSub").textContent = L.subtitle;
  $("gotoIn").placeholder = sys.placeholder;
  $("gotoIn").setAttribute("aria-label", `Go to a ${sys.name} date`);
  $("prev").disabled = sys.clampYear(S.year - 1) === S.year;
  $("next").disabled = sys.clampYear(S.year + 1) === S.year;

  $("band").innerHTML = L.band.map(b => `<div class="${b.accent ? "a" : ""}" style="flex:${b.weight} 1 0"><b>${esc(b.label)}</b><span>${b.value}</span></div>`).join("");
  $("bandL").textContent = L.bandNote;
  $("bandR").textContent = L.bandAccent || "";

  const now = Date.now(), selPt = S.sel, showEv = plannerOnCalendar();
  cellMap = [];
  $("months").className = "months" + (L.months[0].cols > 7 ? " wide" : "");
  $("months").innerHTML = L.months.map(m => {
    const notes = [];
    const cells = m.cells.map(c => {
      const idx = cellMap.push({ ...c, month: m.title }) - 1;
      const cl = ["cell"];
      if (c.cls) { cl.push(c.cls); notes.push(`${m.title} ${c.label}: ${c.note}`); }
      if (now >= c.start && now < c.end) { cl.push("today"); notes.push(`${c.label}: today`); }
      if (selPt != null && selPt >= c.start && selPt < c.end) cl.push("sel");
      if (showEv && calendarEvents(c.start, c.end).length) cl.push("tr");
      return `<button type="button" class="${cl.join(" ")}" data-i="${idx}" aria-label="${esc(c.aria || `${m.title} ${c.label}`)}">${c.label}${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</button>`;
    }).join("");
    return `<article class="card${m.accent ? " a" : ""}"><header><h2>${esc(m.title)}</h2>${m.sub ? `<span class="ls">${esc(m.sub)}</span>` : ""}<span class="len">${esc(m.right)}</span></header>
      ${m.meta ? `<p class="meta">${esc(m.meta)}</p>` : ""}
      <div class="grid" style="grid-template-columns:repeat(${m.cols},minmax(0,1fr))">${m.headers ? m.headers.map(w => `<span class="wd">${w}</span>`).join("") : ""}${"<span></span>".repeat(m.lead)}${cells}</div>
      ${notes.length ? `<ul class="notes">${notes.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}</article>`;
  }).join("");
  $("calFoot").textContent = L.foot;
  detail();
}

function detail() {
  const el = $("detail");
  if (S.msg) { el.innerHTML = `<p>${esc(S.msg)}</p>`; return; }
  const c = S.sel != null && cellMap.find(x => S.sel >= x.start && S.sel < x.end);
  if (!c) {
    el.innerHTML = `<p>Tap a ${S.sys.unit.day.toLowerCase()} to convert it into every other calendar, or type a date in "Go to".</p>`;
    return;
  }
  const end = c.end - 1, at = S.at;
  const rows = ROWS().map(r => `<tr class="${r.id === S.sys.id ? "cur" : ""}"><th>${esc(r.name)}</th>${at != null ? `<td data-l="At">${esc(r.f(at))}</td>` : ""}<td data-l="Starts">${esc(r.f(c.start))}</td><td data-l="Ends">${esc(r.f(end))}</td></tr>`).join("");
  const ev = calendarEvents(c.start, c.end);
  el.innerHTML = `<h3>${esc(S.sys.dayLabel(c.start))}</h3>
    <div class="tablewrap"><table class="conv"><thead><tr><th></th>${at != null ? "<th>At</th>" : ""}<th>Starts</th><th>Ends</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${ev.length ? `<ul class="evlist">${ev.map(eventItem).join("")}</ul>` : ""}`;
}

function setSystem(id) {
  S.sys = byId(id);
  setPref("calSys", id);
  S.year = S.sys.yearOf(S.sel ?? Date.now());
  S.msg = "";
  $("gotoIn").value = "";
  render();
}

function go(year) { S.year = year; S.msg = ""; render(); }

export function initCalendar() {
  radioButtons($("calSys"), SYSTEMS.map(s => ({ id: s.id, label: s.name })), S.sys.id, setSystem);
  $("prev").onclick = () => go(S.year - 1);
  $("next").onclick = () => go(S.year + 1);
  $("today").onclick = () => { S.sel = Date.now(); S.at = S.sel; S.year = S.sys.yearOf(S.sel); S.msg = ""; render(); scrollToSel(); };
  $("months").onclick = e => {
    const b = e.target.closest(".cell");
    if (!b) return;
    const c = cellMap[+b.dataset.i];
    S.sel = c.start; S.at = null; S.msg = "";
    document.querySelectorAll(".cell.sel").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel");
    detail();
    $("detail").scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  $("goto").addEventListener("submit", e => {
    e.preventDefault();
    const raw = $("gotoIn").value;
    const ms = raw.trim() ? S.sys.parse(raw) : null;
    if (ms == null || !isFinite(ms)) { S.msg = `Couldn't read that as a ${S.sys.name} date. Try ${S.sys.placeholder}.`; detail(); return; }
    S.sel = ms; S.at = ms; S.year = S.sys.clampYear(S.sys.yearOf(ms)); S.msg = "";
    render();
    if (!cellMap.some(c => ms >= c.start && ms < c.end)) { S.msg = "That date is outside the range this calendar covers."; detail(); }
    scrollToSel();
  });
  document.addEventListener("keydown", e => {
    if (!active || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (e.key === "ArrowLeft") $("prev").click();
    if (e.key === "ArrowRight") $("next").click();
  });
  // Refresh "today" when the day rolls over
  setInterval(() => { if (active && !document.querySelector(".cell.today")?.matches(":hover")) refreshToday(); }, 60000);
}

function refreshToday() {
  const now = Date.now(), t = document.querySelector(".cell.today");
  if (t) { const c = cellMap[+t.dataset.i]; if (now >= c.start && now < c.end) return; }
  render();
}

function scrollToSel() { requestAnimationFrame(() => document.querySelector(".cell.sel")?.scrollIntoView({ block: "center", behavior: "smooth" })); }

export function showCalendar(on) {
  active = on;
  if (on) render();
}
export const rerenderCalendar = () => { if (active) render(); };
