// Barycentric Julian Date (BJD_TDB) toward a sky direction, low precision (about ±2 s).
// Earth (and Mars) positions relative to the solar-system barycentre use a compact
// solar theory plus Jupiter and Saturn on circular orbits. Use astropy for publication work.
import { TT_DAYS, TT_UTC, D2R, jdFromMs, msFromJd } from "./core.js";
import { marsOrbit } from "./mars.js";

const AU_C = 499.004784; // light time for 1 AU, seconds

export const BASES = {
  sgra: { id: "sgra", ra: 266.416837, dec: -29.007811, name: "Sgr A*", long: "Sagittarius A* (galactic centre)", coords: "RA 17:45:40.0, Dec −29:00:28" },
  acen: { id: "acen", ra: 219.902063, dec: -60.833972, name: "α Cen", long: "α Centauri A (nearest star system)", coords: "RA 14:39:36.5, Dec −60:50:02" },
};

function sunOffset(T) {
  let x = 0, y = 0;
  for (const [lo, a, mu] of [[34.39644 + 3034.74612775 * T, 5.2026, 1 / 1047.35], [49.95424 + 1222.49362201 * T, 9.5367, 1 / 3497.9]]) {
    x -= mu * a * Math.cos(lo * D2R); y -= mu * a * Math.sin(lo * D2R);
  }
  return [x, y];
}

/** Earth position relative to the barycentre, equatorial, AU. */
export function earthBary(jdTT) {
  const n = jdTT - 2451545.0, T = n / 36525;
  const eps = (23.439291 - 0.0130042 * T) * D2R;
  const L = (280.460 + 0.9856474 * n) * D2R, g = (357.528 + 0.9856003 * n) * D2R;
  const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const [sx, sy] = sunOffset(T);
  const x = -R * Math.cos(lam) + sx, y = -R * Math.sin(lam) + sy;
  return [x, y * Math.cos(eps), y * Math.sin(eps)];
}

function project([x, y, z], ra, dec) {
  const a = ra * D2R, d = dec * D2R;
  return AU_C * (x * Math.cos(d) * Math.cos(a) + y * Math.cos(d) * Math.sin(a) + z * Math.sin(d));
}

/** Barycentric light-time correction in seconds for an observer on Earth. */
export function corrSec(jdUTC, ra, dec) {
  if (!isFinite(ra) || !isFinite(dec)) return 0;
  return project(earthBary(jdUTC + TT_DAYS), ra, dec);
}

/** Same correction for an observer on Mars. */
export function corrSecMars(jdUTC, ra, dec) {
  const jdTT = jdUTC + TT_DAYS, { Ls, nu, d } = marsOrbit(jdTT), T = d / 36525;
  const l = (Ls + 85.061 - 0.015 * Math.sin((71 + 2 * Ls) * D2R) - 5.5e-6 * d) * D2R;
  const b = 1.8497 * Math.sin((Ls - 144.5) * D2R) * D2R;
  const r = 1.523679 * (1 - 0.0934 * 0.0934) / (1 + 0.0934 * Math.cos(nu));
  const [sx, sy] = sunOffset(T);
  const x = r * Math.cos(b) * Math.cos(l) + sx, y = r * Math.cos(b) * Math.sin(l) + sy, z = r * Math.sin(b);
  const eps = 23.439291 * D2R;
  return project([x, y * Math.cos(eps) - z * Math.sin(eps), y * Math.sin(eps) + z * Math.cos(eps)], ra, dec);
}

export const bjd = (jdUTC, t) => jdUTC + (TT_UTC + corrSec(jdUTC, t.ra, t.dec)) / 86400;

export function utcFromBjd(b, t) {
  let jd = b - TT_DAYS;
  for (let i = 0; i < 3; i++) jd = b - (TT_UTC + corrSec(jd, t.ra, t.dec)) / 86400;
  return jd;
}

export const bjdFromMs = (ms, t) => bjd(jdFromMs(ms), t);
export const msFromBjd = (b, t) => msFromJd(utcFromBjd(b, t));

const ampCache = new Map();
/** Peak |correction| in minutes over one year (Earth) or 687 days (Mars). */
export function amplitude(t, onMars = false) {
  const key = `${t.ra},${t.dec},${onMars}`;
  if (ampCache.has(key)) return ampCache.get(key);
  const j = jdFromMs(Date.now()), span = onMars ? 687 : 366, f = onMars ? corrSecMars : corrSec;
  let m = 0;
  for (let i = 0; i < span; i += 3) m = Math.max(m, Math.abs(f(j + i, t.ra, t.dec)));
  ampCache.set(key, m / 60);
  return m / 60;
}

/** Parse "hh:mm:ss" / "±dd:mm:ss" / decimal degrees. */
export function parseAngle(s, isRA) {
  s = (s || "").trim();
  if (!s) return NaN;
  if (/[:\shdm°'"]/.test(s)) {
    const neg = /^-/.test(s);
    const p = s.replace(/^[+-]/, "").split(/[:\shdm°'"]+/).filter(Boolean).map(Number);
    if (p.some(isNaN)) return NaN;
    const v = (p[0] || 0) + (p[1] || 0) / 60 + (p[2] || 0) / 3600;
    return (neg ? -1 : 1) * v * (isRA ? 15 : 1);
  }
  const v = Number(s);
  return isNaN(v) ? NaN : v;
}
