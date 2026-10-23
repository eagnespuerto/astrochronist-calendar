// One adapter per calendar. Each gives the Calendar tab a year layout (Mars-calendar style:
// a year of "month" cards full of day cells) and the Now tab its day / month / year parts.
// Every cell carries real start and end instants, so any cell converts to every other system.
import {
  pad, fmt, nf, hms, mod, localMs, MONTHS, WEEKDAYS, jdFromMs,
  fmtUTCDate, fmtUTCShort, fmtUTCFull, isoUTC,
} from "./time/core.js";
import * as Mars from "./time/mars.js";
import { BASES, bjdFromMs, msFromBjd, corrSec, bjdYear, bjdYearStart, dayFromBjdYear } from "./time/bary.js";
import { lst, msFromLst, lstString, clock, moonPhase, meanPhaseMs, SYNODIC } from "./time/lunar.js";

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
const fLocalDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fLocalTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fLocalHM = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/* ---------------- Gregorian (local days) ---------------- */
const isLeapG = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function isoWeek(ms) {
  const d = new Date(ms), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}

export const gregorian = {
  id: "greg", name: "Gregorian", menu: "Gregorian · local & UTC",
  unit: { day: "Day", month: "Month", year: "Year" },
  yearOf: ms => new Date(ms).getFullYear(),
  clampYear: y => y,
  yearTitle: y => y > 0 ? String(y) : `${1 - y} BC`,
  layout(y) {
    const months = MONTHS.map((name, m) => {
      const nd = new Date(localMs(y, m + 1, 0)).getDate();
      const cells = [];
      for (let d = 1; d <= nd; d++) cells.push({ label: d, start: localMs(y, m, d), end: localMs(y, m, d + 1) });
      return {
        title: name, right: `${nd} days`, meta: "", cols: 7,
        headers: ["S", "M", "T", "W", "T", "F", "S"], lead: new Date(localMs(y, m, 1)).getDay(), cells,
      };
    });
    const leap = isLeapG(y);
    return {
      subtitle: `${leap ? 366 : 365} days, ${leap ? "leap" : "common"} year. Days run midnight to midnight in ${tz()}.`,
      band: months.map((m, i) => ({ label: m.title.slice(0, 3), value: m.cells.length, weight: m.cells.length })),
      bandNote: "Month lengths follow Roman custom, not the sky.",
      months,
      foot: "Gregorian days are civil days in your time zone, so they shift with daylight saving. Every other calendar here counts from a sky event instead.",
    };
  },
  label: ms => fLocalHM.format(ms),
  dayLabel: ms => fLocalDate.format(ms),
  now(ms, geo) {
    const d = new Date(ms);
    const start = localMs(d.getFullYear(), 0, 1);
    const doy = Math.floor((localMs(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 864e5) + 1;
    return {
      time: fLocalTime.format(ms),
      timeNote: tz(),
      day: { v: d.getDate(), sub: WEEKDAYS[d.getDay()] },
      month: { v: MONTHS[d.getMonth()], sub: `month ${d.getMonth() + 1}` },
      year: { v: d.getFullYear(), sub: `day ${doy} · ISO week ${isoWeek(ms)}` },
      extras: [["UTC", isoUTC(ms).slice(11)], ["UTC date", isoUTC(ms).slice(0, 10)]],
    };
  },
  placeholder: "2026-10-23 or 2026-10-23 18:30",
  parse(s) {
    const m = s.trim().match(/^(-?\d{1,6})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    return localMs(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  },
};

/* ---------------- Mars Year calendar ---------------- */
const marsEvents = n => {
  const base = 360 * Math.round(Mars.lcont(Mars.astro[n]) / 360);
  return {
    [Math.floor(Mars.solveL(base + 71, Mars.astro[n] + 218))]: "Aphelion (Ls 71°)",
    [Math.floor(Mars.solveL(base + 251, Mars.astro[n] + 485))]: "Perihelion (Ls 251°)",
  };
};
const marsDateStr = m => {
  const d = Mars.marsDate(m);
  return d ? `MY ${d.my} · M${d.month} sol ${d.sol}` : `MSD ${fmt(m)}`;
};

export const mars = {
  id: "mars", name: "Martian", menu: "Martian · Mars Year & MTC",
  unit: { day: "Sol", month: "Month", year: "Mars Year" },
  yearOf: ms => Mars.yearOfSol(Math.floor(Mars.msdFromMs(ms))) ?? (ms < 0 ? Mars.MY_MIN : Mars.MY_MAX),
  clampYear: y => Math.min(Mars.MY_MAX, Math.max(Mars.MY_MIN, y)),
  yearTitle: n => `Mars Year ${n}`,
  layout(n) {
    const lens = Mars.monthLengths(n), ev = marsEvents(n);
    const leapSol = Mars.leap(n) ? Mars.wb[n + 1] - 1 : null;
    let m0 = Mars.wb[n];
    const months = lens.map((len, i) => {
      const cells = [];
      for (let s = 1; s <= len; s++) {
        const m = m0 + s - 1, cell = { label: s, start: Mars.msFromMsd(m), end: Mars.msFromMsd(m + 1) };
        if (ev[m]) { cell.cls = "ev"; cell.note = ev[m]; }
        if (m === leapSol) { cell.cls = "leapsol"; cell.note = "Leap sol"; }
        cells.push(cell);
      }
      const card = {
        title: `M${i + 1}`, sub: `Ls ${30 * i}°–${30 * i + 30}°`, right: `${len} sols`,
        meta: `${Mars.SEASONS[Math.floor(i / 3)]}, ${fmtUTCShort.format(Mars.msFromMsd(m0))} to ${fmtUTCDate.format(Mars.msFromMsd(m0 + len - 1))}`,
        cols: 7, headers: Mars.WEEK, lead: mod(m0 - Mars.wb[1], 7), cells, accent: i >= 6,
      };
      m0 += len;
      return card;
    });
    const tot = Mars.yearLen(n);
    const long = Math.max(...lens), short = Math.min(...lens);
    return {
      subtitle: `${tot} sols, ${Mars.leap(n) ? "leap" : "common"} year. ${fmtUTCDate.format(Mars.msFromMsd(Mars.wb[n]))} to ${fmtUTCDate.format(Mars.msFromMsd(Mars.wb[n + 1] - 1))} on Earth.`,
      band: months.map((m, i) => ({ label: m.title, value: lens[i], weight: lens[i], accent: i >= 6 })),
      bandNote: `Widths to scale: Mars moves slowest near aphelion, so M${lens.indexOf(long) + 1} runs ${long - short} sols longer than M${lens.indexOf(short) + 1}.`,
      bandAccent: "Dust storm season, Ls 180° to 360°",
      months,
      foot: "Months are 30° slices of solar longitude (Ls) rounded to whole sols. Odd years and years divisible by 10 have 669 sols; the leap sol ends M12. Sol 1 of MY 1 is the sol of the 1955 northern spring equinox, and weeks run on unbroken from it. Sols run from Airy-0 midnight. The Science tab has the exact Ls month boundaries.",
    };
  },
  label(ms) {
    const msd = Mars.msdFromMs(ms);
    return `${marsDateStr(Math.floor(msd))}, ${hms(msd).slice(0, 5)} MTC`;
  },
  dayLabel: ms => marsDateStr(Math.floor(Mars.msdFromMs(ms))),
  now(ms, geo) {
    const msd = Mars.msdFromMs(ms), d = Mars.marsDate(Math.floor(msd)), ls = Mars.ls(msd);
    const ex = [["Mars Sol Date", nf(msd, 4)], ["Solar longitude", `Ls ${ls.toFixed(2)}°`], ["Season", Mars.SEASONS[Math.floor(ls / 90)]]];
    if (geo) ex.push(["Mars time at your longitude", hms(msd + geo.lon / 360) + " LMST"]);
    return {
      time: hms(msd), timeNote: "Coordinated Mars Time (Airy-0)",
      day: { v: d ? d.sol : "—", sub: d ? `weekday ${d.weekday + 1} · sol ${d.solOfYear} of year` : "" },
      month: { v: d ? `M${d.month}` : "—", sub: d ? `Ls ${30 * (d.month - 1)}°–${30 * d.month}°` : "" },
      year: { v: d ? `MY ${d.my}` : "—", sub: d ? `${Mars.yearLen(d.my)} sols` : "" },
      extras: ex,
    };
  },
  placeholder: "MY 38 M7 12, or MSD 54321.5",
  parse(s) {
    s = s.trim();
    let m = s.match(/^msd\s*([\d.]+)$/i);
    if (m) return Mars.msFromMsd(+m[1]);
    m = s.match(/^(?:my\s*)?(-?\d+)\s*[-/ ,]\s*(?:m\s*)?(\d{1,2})\s*[-/ ,]\s*(?:sol\s*)?(\d{1,2})$/i);
    if (!m) return null;
    const sol = Mars.solFromMarsDate(+m[1], +m[2], +m[3]);
    return sol == null ? null : Mars.msFromMsd(sol);
  },
};

/* ---------------- Lunar Standard Time ---------------- */
export const lunar = {
  id: "lunar", name: "Lunar Standard", menu: "Lunar Standard Time",
  unit: { day: "Cycle", month: "Lunar day", year: "Lunar year" },
  yearOf: ms => lst(ms).year,
  clampYear: y => y,
  yearTitle: y => `Lunar Year ${y}`,
  layout(y) {
    const t0 = msFromLst(y, 1, 1), t1 = msFromLst(y + 1, 1, 1);
    // Mean new and full moons inside this year
    const k0 = Math.floor((t0 - meanPhaseMs(0)) / (SYNODIC * 864e5)) - 1;
    const phases = [];
    for (let k = k0; k < k0 + 16; k++) for (const h of [0, 0.5]) {
      const t = meanPhaseMs(k + h);
      if (t >= t0 && t < t1) phases.push({ t, note: h ? "Full moon (mean)" : "New moon (mean)" });
    }
    const months = [];
    for (let d = 1; d <= 12; d++) {
      const cells = [];
      for (let c = 1; c <= 30; c++) {
        const start = msFromLst(y, d, c), end = msFromLst(y, d, c + 1);
        const cell = { label: c, sub: fmtUTCShort.format(start), start, end };
        const ph = phases.find(p => p.t >= start && p.t < end);
        if (ph) { cell.cls = "ev"; cell.note = ph.note; }
        cells.push(cell);
      }
      months.push({
        title: `Day ${d}`, right: "30 cycles",
        meta: `${fmtUTCShort.format(cells[0].start)} to ${fmtUTCDate.format(cells[29].start)}`,
        cols: 10, headers: null, lead: 0, cells,
      });
    }
    return {
      subtitle: `12 lunar days of ${SYNODIC.toFixed(3)} Earth days each (${(12 * SYNODIC).toFixed(2)} days). Starts ${fmtUTCFull.format(t0)} UTC.`,
      band: months.map(m => ({ label: m.title.replace("Day ", "D"), value: "", weight: 1 })),
      bandNote: "Each lunar day is one mean synodic month, new moon to new moon, so the phases land on the same cycle every lunar day.",
      months,
      foot: "Lunar Standard Time (Kenneth L. Lee, 1970) starts at 1-01-01 ∇ 00:00:00, the moment Neil Armstrong stepped onto the Moon (1969-07-21 02:56:15 UTC). A cycle is 24 lunar hours, each 0.984 Earth hours long, so cycles drift slowly against Earth days. Small dates under each cycle are UTC.",
    };
  },
  label: ms => lstString(ms),
  dayLabel: ms => lstString(ms, false),
  now(ms) {
    const p = lst(ms), ph = moonPhase(ms);
    return {
      time: "∇ " + clock(p.frac), timeNote: "Lunar hours, minutes, seconds",
      day: { v: p.cycle, sub: "cycle of 30" },
      month: { v: p.day, sub: "lunar day of 12" },
      year: { v: p.year, sub: "since Apollo 11" },
      extras: [["LST", lstString(ms)], ["Phase", `${ph.name}, ${Math.round(ph.illum * 100)}% lit`], ["Lunation", `${fmt(ph.lunation)} (Brown ${fmt(ph.brown)})`]],
    };
  },
  placeholder: "58-03-12 or 58-03-12 ∇ 10:00:00",
  parse(s) {
    const m = s.trim().match(/^(-?\d+)-(\d{1,2})-(\d{1,2})(?:\s*(?:∇|v)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i);
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 30) return null;
    const frac = ((+(m[4] || 0)) * 3600 + (+(m[5] || 0)) * 60 + (+(m[6] || 0))) / 86400;
    return msFromLst(+m[1], +m[2], +m[3], Math.min(frac, 0.999999));
  },
};

/* ---------------- BJD calendars (Sol–Sgr A*, Sol–α Cen) ---------------- */
function bjdSystem(base) {
  return {
    id: "bjd-" + base.id, base, name: `BJD · Sol–${base.name}`, menu: `BJD · Sol–${base.name}`,
    unit: { day: "Day", month: "Hectoday", kilo: "Kiloday", year: "Year" },
    yearOf: ms => Math.floor(Math.floor(bjdFromMs(ms, base)) / 1000),
    clampYear: y => y,
    yearTitle: k => `Kiloday ${fmt(k)}`,
    layout(K) {
      const nowN = Math.floor(bjdFromMs(Date.now(), base));
      const months = [];
      for (let h = 0; h < 10; h++) {
        const cells = [];
        for (let i = 0; i < 100; i++) {
          const N = K * 1000 + h * 100 + i, start = msFromBjd(N, base), end = msFromBjd(N + 1, base);
          const Y = bjdYear(N);
          const cell = { label: pad(N % 1000, 3), sub: fmtUTCShort.format(start), start, end, aria: `Day ${fmt(N)}, Year ${fmt(Y.year)} day ${Y.doy}` };
          if (Y.doy === 1) {
            const y0 = bjdYearStart(Y.year);
            cell.cls = "ev";
            cell.note = `Year ${fmt(Y.year)} begins` + (y0 === N ? "" : ` (the year itself starts at BJD ${fmt(Math.floor(y0))}${(y0 % 1).toFixed(2).slice(1)}, during the day before)`);
          }
          cells.push(cell);
        }
        months.push({
          title: `Hectoday ${h}`, sub: `days ${h}00–${h}99`, right: "100 days",
          meta: `${fmtUTCShort.format(cells[0].start)} to ${fmtUTCDate.format(cells[99].start)}`,
          cols: 10, headers: [...Array(10)].map((_, i) => "+" + i), lead: 0, cells,
          accent: nowN >= K * 1000 + h * 100 && nowN < K * 1000 + h * 100 + 100,
        });
      }
      const ya = bjdYear(K * 1000), yb = bjdYear(K * 1000 + 999);
      return {
        subtitle: `Days ${fmt(K * 1000)} to ${fmt(K * 1000 + 999)}, from Year ${fmt(ya.year)} day ${ya.doy} to Year ${fmt(yb.year)} day ${yb.doy}: ${fmtUTCDate.format(months[0].cells[0].start)} to ${fmtUTCDate.format(months[9].cells[99].start)}. Day numbers are BJD_TDB toward ${base.long}.`,
        band: months.map((m, i) => ({ label: `H${i}`, value: "", weight: 1, accent: m.accent })),
        bandNote: "Ten hectodays of 100 days make a kiloday. The highlighted hectoday holds today.",
        months,
        foot: `Each day starts when the barycentric Julian Date toward ${base.name} (${base.coords}) passes a whole number, near noon UTC. That moment shifts by a few minutes over the year as Earth swings around the Sun's barycentre, but everyone on Earth shares the same day number at once. Years are 365.25 days counted from BJD 0, so Year 1 starts at second 0; a day belongs to the year it starts in, which gives 366, 365, 365 and 365 days in each four-year cycle. Highlighted days begin a new year. Small dates under each day are the UTC date it starts on.`,
      };
    },
    label(ms) {
      const b = bjdFromMs(ms, base), Y = bjdYear(Math.floor(b));
      // Truncate (not round) so a day's last instant never reads as the next whole day
      return `BJD ${(Math.floor(b * 1e5) / 1e5).toFixed(5)} · Year ${fmt(Y.year)} day ${Y.doy}`;
    },
    dayLabel(ms) {
      const N = Math.floor(bjdFromMs(ms, base)), Y = bjdYear(N);
      return `Day ${fmt(N)} · Year ${fmt(Y.year)}, day ${Y.doy}`;
    },
    now(ms) {
      const b = bjdFromMs(ms, base), N = Math.floor(b), j = jdFromMs(ms), Y = bjdYear(N);
      const start = msFromBjd(N, base);
      const wk = WEEKDAYS[mod(N + 1, 7)];
      return {
        time: hms((ms - start) / 864e5), timeNote: `into BJD day · fraction ${(b - N).toFixed(5)}`,
        day: { v: pad(N % 1000, 3), sub: `${wk} · day ${fmt(N)}` },
        month: { v: `H${Math.floor((N % 1000) / 100)}`, sub: "hectoday of 10" },
        kilo: { v: fmt(Math.floor(N / 1000)), sub: "kiloday" },
        year: { v: fmt(Y.year), sub: `day ${Y.doy} of ${Y.len}` },
        extras: [["BJD_TDB", b.toFixed(6)], ["Barycentric shift", `${(corrSec(j, base.ra, base.dec) / 60).toFixed(2)} min`], ["Toward", base.long]],
      };
    },
    placeholder: "2461340.5 (BJD), 61340 (MJD), or Year 6739 day 281",
    parse(s) {
      const ym = s.trim().match(/^(?:year|y)\s*(-?[\d,]+)\s*[, ]\s*(?:day|d)\s*(\d{1,3})$/i);
      if (ym) {
        const y = +ym[1].replace(/,/g, ""), d = +ym[2];
        if (!(d >= 1 && d <= bjdYear(dayFromBjdYear(y, 1)).len)) return null;
        return msFromBjd(dayFromBjdYear(y, d), base);
      }
      const v = parseFloat(s.replace(/,/g, ""));
      if (!isFinite(v)) return null;
      return msFromBjd(v < 100000 ? v + 2400000.5 : v, base);
    },
  };
}

export const bjdSgra = bjdSystem(BASES.sgra);
export const bjdAcen = bjdSystem(BASES.acen);

export const SYSTEMS = [gregorian, mars, lunar, bjdSgra, bjdAcen];
export const byId = id => SYSTEMS.find(s => s.id === id) || gregorian;
