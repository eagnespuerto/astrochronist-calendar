// Lunar Standard Time (Kenneth L. Lee, 1970). The clock starts at 1-01-01 ∇ 00:00:00,
// the moment Neil Armstrong stepped onto the Moon (1969-07-21 02:56:15 UTC).
// One lunar "day" is a mean synodic month, split into 30 "cycles" of 24 lunar hours.
// Twelve lunar days make a lunar year (about 354.37 Earth days).
import { DAY_MS, jdFromMs, mod } from "./core.js";

export const SYNODIC = 29.530588853;                 // mean synodic month, Earth days
export const LST_EPOCH = Date.UTC(1969, 6, 21, 2, 56, 15);
const DAY = SYNODIC * DAY_MS;                        // one lunar day in ms
export const CYCLE_MS = DAY / 30;
export const LUNAR_SECOND = SYNODIC * 86400 / (30 * 86400); // ≈ 0.98435 SI seconds

/** Instant → LST parts. year/day/cycle are 1-based. */
export function lst(ms) {
  const t = (ms - LST_EPOCH) / DAY;                  // lunar days since epoch
  const di = Math.floor(t);
  const year = Math.floor(di / 12) + 1;
  const day = mod(di, 12) + 1;
  const c = (t - di) * 30;
  const cycle = Math.floor(c) + 1;
  const frac = c - Math.floor(c);                    // fraction of the cycle
  return { year, day, cycle, frac, t };
}

export function msFromLst(year, day, cycle, frac = 0) {
  return LST_EPOCH + ((year - 1) * 12 + (day - 1)) * DAY + (cycle - 1 + frac) * CYCLE_MS;
}

export function lstString(ms, withTime = true) {
  const p = lst(ms);
  const s = `${p.year}-${String(p.day).padStart(2, "0")}-${String(p.cycle).padStart(2, "0")}`;
  return withTime ? `${s} ∇ ${clock(p.frac)}` : s;
}

export function clock(frac) {
  const t = Math.floor(frac * 86400 + 1e-6);
  const p = v => String(v).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
}

// Mean lunar phase. Meeus lunation 0 = new moon of 2000-01-06 18:14 TT.
const NEW0 = 2451550.09766;
export function moonPhase(ms) {
  const x = (jdFromMs(ms) - NEW0) / SYNODIC;
  const lunation = Math.floor(x);
  const age = (x - lunation) * SYNODIC;
  const illum = (1 - Math.cos(2 * Math.PI * (x - lunation))) / 2;
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  return { lunation, brown: lunation + 953, age, illum, name: names[Math.floor(mod(x - lunation + 1 / 16, 1) * 8)] };
}

/** Instant of mean new moon (k integer) or full moon (k + 0.5). */
export const meanPhaseMs = k => (NEW0 + k * SYNODIC - 2440587.5) * DAY_MS;
