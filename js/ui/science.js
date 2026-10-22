// Science tab: live time scales, BJD and Mars details, exact Mars months, transit planner.
import { jdFromMs, fmt, nf, hms, isoUTC, mod, fmtUTCFull, fmtLocalFull, WEEKDAYS } from "../time/core.js";
import { BASES, bjd, bjdFromMs, msFromBjd, corrSec, corrSecMars, amplitude, parseAngle } from "../time/bary.js";
import * as Mars from "../time/mars.js";
import { lst, lstString, moonPhase, SYNODIC, LUNAR_SECOND } from "../time/lunar.js";
import { prefs, setPref, $, esc, radioButtons } from "./prefs.js";

const DEF = { name: "Sample target", ra: "14:40:00", dec: "-45:00:00", t0: "2461300.43210", per: "2.718281", dur: "3.2", sec: true, cal: false };
const F = { name: "eName", ra: "eRa", dec: "eDec", t0: "eT0", per: "ePer", dur: "eDur" };
let base = BASES[prefs().sciBase] || BASES.sgra;
let active = false;

/* ---------- planner ---------- */
function cfg() {
  return {
    name: $("eName").value.trim() || "Target",
    ra: parseAngle($("eRa").value, true), dec: parseAngle($("eDec").value, false),
    t0: parseFloat($("eT0").value), per: parseFloat($("ePer").value), dur: parseFloat($("eDur").value),
    sec: $("eSec").checked, cal: $("eCal").checked,
  };
}
function eventsBjd(b0, b1, c, cap = 60) {
  const out = [];
  if (!(c.per > 0) || !isFinite(c.t0) || !isFinite(c.ra) || !isFinite(c.dec)) return out;
  for (const ph of c.sec ? [0, 0.5] : [0]) {
    const t0 = c.t0 + ph * c.per;
    for (let n = Math.ceil((b0 - t0) / c.per), k = 0; k < cap; n++, k++) {
      const t = t0 + n * c.per;
      if (t >= b1) break;
      out.push({ n, ph, t, ms: msFromBjd(t, c) });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Events between two instants, or [] when the planner isn't shown on the calendar. */
export function calendarEvents(startMs, endMs) {
  const c = cfg();
  if (!c.cal) return [];
  return eventsBjd(bjdFromMs(startMs, c), bjdFromMs(endMs, c), c).map(e => ({ ...e, name: c.name, dur: c.dur }));
}
export const plannerOnCalendar = () => $("eCal").checked;

const utcHM = ms => isoUTC(ms).slice(11, 16);
export function eventItem(e) {
  const half = isFinite(e.dur) && e.dur > 0 ? e.dur * 1800e3 : 0;
  return `<li class="${e.ph ? "s" : ""}"><strong>${esc(e.name)} · ${e.ph ? "secondary" : "primary"} · E = ${e.n}</strong>
    <span class="t">BJD ${e.t.toFixed(5)}</span>
    <span class="t">${isoUTC(e.ms)} UTC</span>
    <span>${fmtLocalFull.format(e.ms)}</span>
    ${half ? `<span class="t">${utcHM(e.ms - half)}–${utcHM(e.ms + half)} UTC</span>` : ""}</li>`;
}

function renderPlanner() {
  const c = cfg(), nb = bjdFromMs(Date.now(), c);
  const ev = c.per > 0 ? eventsBjd(nb, nb + Math.max(c.per * 6, 1), c, 8).slice(0, 6) : [];
  $("upcoming").innerHTML = ev.length ? ev.map(e => eventItem({ ...e, name: c.name, dur: c.dur })).join("")
    : `<li class="s">Enter RA, Dec, T0 and period to list upcoming events.</li>`;
  $("ephNote").hidden = !["ra", "dec", "t0", "per"].every(k => $(F[k]).value === DEF[k]);
}

/* ---------- exact Mars months ---------- */
function renderExact() {
  let n = Math.round(+$("exactMY").value);
  if (!isFinite(n)) return;
  n = Math.min(Mars.MY_MAX, Math.max(Mars.MY_MIN, n));
  const b = [];
  for (let i = 0; i <= 12; i++) b.push(Mars.boundary(n, i));
  $("exactTbl").innerHTML = `<thead><tr><th>Month</th><th>Ls</th><th>Starts (MSD)</th><th>Starts (UTC)</th><th>Length (sols)</th></tr></thead><tbody>${
    b.slice(0, 12).map((s, i) => `<tr><td>M${i + 1}</td><td>${30 * i}°–${30 * i + 30}°</td><td>${nf(s, 3)}</td><td>${fmtUTCFull.format(Mars.msFromMsd(s))}</td><td>${nf(b[i + 1] - s, 3)}</td></tr>`).join("")
  }<tr><td colspan="4"><strong>Mars Year ${n}</strong>, Ls 0° to 360°</td><td><strong>${nf(b[12] - b[0], 3)}</strong></td></tr></tbody>`;
}

/* ---------- live cards ---------- */
const card = (lbl, v, p) => `<div><span class="lbl">${lbl}</span><span class="v">${v}</span><p>${p}</p></div>`;
const mmss = s => { const a = Math.abs(s), m = Math.floor(a / 60); return `${s < 0 ? "−" : "+"}${m} min ${Math.round(a - 60 * m)} s`; };

function tick() {
  if (!active) return;
  const now = Date.now(), j = jdFromMs(now), jt = j + 69.184 / 86400;
  const msd = Mars.msdFromMs(now), ls = Mars.ls(msd), md = Mars.marsDate(Math.floor(msd)), ph = moonPhase(now);
  const bS = bjdFromMs(now, BASES.sgra), bA = bjdFromMs(now, BASES.acen);
  const cells = [
    ["UTC", isoUTC(now)], ["JD (UTC)", j.toFixed(5)], ["MJD", (j - 2400000.5).toFixed(5)], ["JD (TT)", jt.toFixed(5)],
    ["BJD<sub>TDB</sub> · Sgr A*", bS.toFixed(5)], ["BJD<sub>TDB</sub> · α Cen", bA.toFixed(5)],
    ["Mars Sol Date", nf(msd, 5)], ["MTC", hms(msd)], ["Mars date", md ? `MY ${md.my} M${md.month} sol ${md.sol}` : "—"],
    ["Ls", ls.toFixed(3) + "°"], ["LST", lstString(now)], ["Lunation", `${fmt(ph.lunation)} · ${ph.age.toFixed(2)} d`],
  ];
  $("strip").innerHTML = cells.map(([a, b]) => `<div><div class="lbl">${a}</div><div class="v">${b}</div></div>`).join("");

  const B = bjdFromMs(now, base), N = Math.floor(B), dayStart = msFromBjd(N, base), next = msFromBjd(N + 1, base);
  const jpYear = Math.floor(N / 365.25) + 1, jpDay = Math.floor(N - (jpYear - 1) * 365.25) + 1;
  const fLoc = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  $("bjdCards").innerHTML = [
    card("Today is day", fmt(N), `Rolls over to ${fmt(N + 1)} at ${fLoc.format(next)}, your time.`),
    card(`Shift from JD now (${base.name})`, mmss(corrSec(j, base.ra, base.dec)), `Swings ±${amplitude(base).toFixed(1)} min over a year toward ${base.name}, so BJD midnight wobbles.`),
    card("Weekday", `${WEEKDAYS[mod(N + 1, 7)]}`, "floor(JD + 1.5) mod 7, with 0 = Sunday. Weekdays survive the switch."),
    card("Kiloday", fmt(Math.floor(N / 1000)), `Day ${N % 1000} of 1,000. Kiloday ${fmt(Math.floor(N / 1000) + 1)} starts ${new Date(msFromBjd((Math.floor(N / 1000) + 1) * 1000, base)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.`),
    card("Julian Period year", fmt(jpYear), `Day ${jpDay} of a 365.25-day year. Counted from 4713 BC; the period ends in AD 3268.`),
    card("Sgr A* vs α Cen", mmss((bS - bA) * 86400), "How far apart the two BJD baselines are right now."),
  ].join("");

  const f0 = Mars.msdFromMs(dayStart) % 1, rate = 1 - 1 / Mars.SOLD, into = (1 - f0) * Mars.SOLD;
  $("marsCards").innerHTML = [
    card("Mars Sol Date", nf(msd, 4), `Mars's day count, like JD. One sol = ${Mars.SOLD.toFixed(5)} Earth days.`),
    card("Coordinated Mars Time", hms(msd), "Mean solar time at Airy-0, Mars's prime meridian."),
    card("Season", `Ls ${ls.toFixed(1)}°`, `${md ? `Mars Year ${md.my}, ` : ""}${Mars.SEASONS[Math.floor(ls / 90)].toLowerCase()}. Ls is Mars's orbital angle from its spring equinox.`),
    card("Sol vs BJD day", into < 1 ? `+${Math.floor(into * 24)} h ${Math.floor(into * 1440) % 60} m` : "no sol start",
      `${into < 1 ? `Sol ${fmt(Math.floor(Mars.msdFromMs(dayStart)) + 1)} begins this long after BJD day ${fmt(N)} starts.` : `No sol begins during BJD day ${fmt(N)}.`} Boundaries line up again in ${Math.ceil(f0 / rate)} days.`),
    card("Shift from JD on Mars", mmss(corrSecMars(j, base.ra, base.dec)), `Toward ${base.name}, a Mars clock sees BJD midnight swing ±${amplitude(base, true).toFixed(1)} min over 687 days (Earth: ±${amplitude(base).toFixed(1)}).`),
  ].join("");

  const p = lst(now);
  $("lunarCards").innerHTML = [
    card("Lunar Standard Time", lstString(now), `Year ${p.year}, lunar day ${p.day}, cycle ${p.cycle}. One lunar second = ${LUNAR_SECOND.toFixed(5)} SI seconds.`),
    card("Mean phase", `${Math.round(ph.illum * 100)}% lit`, `${ph.name}, ${ph.age.toFixed(2)} days since mean new moon. True phases can differ by up to about 14 hours.`),
    card("Lunation", fmt(ph.lunation), `Meeus numbering (0 = 6 Jan 2000). Brown lunation ${fmt(ph.brown)}.`),
    card("Synodic month", `${SYNODIC.toFixed(6)} d`, "New moon to new moon. One LST lunar day, by definition."),
  ].join("");
}

export function initScience(onPlannerChange) {
  const saved = prefs().eph || {};
  for (const k in F) $(F[k]).value = saved[k] ?? DEF[k];
  $("eSec").checked = saved.sec ?? DEF.sec;
  $("eCal").checked = saved.cal ?? DEF.cal;
  $("eph").addEventListener("submit", e => e.preventDefault());
  $("eph").addEventListener("input", () => {
    const v = {};
    for (const k in F) v[k] = $(F[k]).value;
    v.sec = $("eSec").checked; v.cal = $("eCal").checked;
    setPref("eph", v);
    renderPlanner();
    onPlannerChange();
  });
  radioButtons($("sciBase"), Object.values(BASES).map(b => ({ id: b.id, label: b.name })), base.id, id => {
    base = BASES[id]; setPref("sciBase", id); tick();
  });
  const my = Mars.yearOfSol(Math.floor(Mars.msdFromMs(Date.now())));
  $("exactMY").value = my; $("exactMY").min = Mars.MY_MIN; $("exactMY").max = Mars.MY_MAX;
  $("exactMY").addEventListener("input", renderExact);
  renderExact();
  renderPlanner();
  setInterval(tick, 1000);
}

export function showScience(on) {
  active = on;
  if (on) { tick(); renderPlanner(); }
}
