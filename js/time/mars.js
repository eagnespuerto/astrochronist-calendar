// Mars time: Mars Sol Date, solar longitude (Allison & McEwen 2000 / Mars24),
// and the Mars Year calendar (MY 1 = sol of the 1955 northern spring equinox,
// Clancy et al. 2000 numbering).
import { DAY_MS, JD_UNIX, TT_DAYS, D2R, mod } from "./core.js";

export const SOLD = 1.0274912517;          // Earth days per sol
export const JD0 = 2405522.0028779;        // JD(TT) of MSD 0

const PA = [.0071, .0057, .0039, .0037, .0021, .0020, .0018];
const PT = [2.2353, 2.7543, 1.1177, 15.7866, 2.1354, 2.4694, 32.8493];
const PP = [49.409, 168.173, 191.837, 21.736, 15.704, 95.528, 49.095];

/** Orbit terms for days since J2000 (TT). Ls is unwrapped (keeps growing). */
function orbitD(d) {
  const M = (19.3871 + 0.52402073 * d) * D2R;
  const aFMS = 270.3871 + 0.524038496 * d;
  let pbs = 0;
  for (let i = 0; i < 7; i++) pbs += PA[i] * Math.cos((0.985626 * d / PT[i] + PP[i]) * D2R);
  const eoc = (10.691 + 3e-7 * d) * Math.sin(M) + 0.623 * Math.sin(2 * M) + 0.050 * Math.sin(3 * M)
    + 0.005 * Math.sin(4 * M) + 0.0005 * Math.sin(5 * M) + pbs;
  return { lcont: aFMS + eoc, nu: M + eoc * D2R, d };
}

export function marsOrbit(jdTT) {
  const o = orbitD(jdTT - 2451545.0);
  return { Ls: mod(o.lcont, 360), nu: o.nu, d: o.d };
}

export const msdFromMs = ms => (ms / DAY_MS + JD_UNIX + TT_DAYS - JD0) / SOLD;
export const msFromMsd = m => ((m * SOLD + JD0 - TT_DAYS) - JD_UNIX) * DAY_MS;
export const lcont = msd => orbitD(msd * SOLD + JD0 - 2451545.0).lcont;
export const ls = msd => mod(lcont(msd), 360);
/** Coordinated Mars Time as a sol fraction (Airy-0 mean solar time). */
export const mtcFrac = msd => mod(msd, 1);

export const SEASONS = ["Northern spring", "Northern summer", "Northern autumn", "Northern winter"];
export const MONTH_LEN = [61, 65, 67, 64, 60, 54, 50, 47, 46, 47, 51, 56]; // sums to 668
export const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

const MSD1955 = msdFromMs(Date.UTC(1955, 3, 11));
const K0 = Math.round(lcont(MSD1955) / 360);

export function solveL(target, guess) {
  let m = guess;
  for (let k = 0; k < 40; k++) {
    const f = lcont(m) - target;
    if (Math.abs(f) < 1e-9) break;
    m -= f / ((lcont(m + .01) - lcont(m - .01)) / .02);
  }
  return m;
}

/** Exact MSD when Ls crosses 30·i degrees in Mars Year n (i = 0..12). */
export const boundary = (n, i) => solveL(360 * (K0 + n - 1) + 30 * i, MSD1955 + (n - 1) * 668.5921 + i * 55.7);

export const leap = n => mod(n, 2) === 1 || mod(n, 10) === 0;
export const yearLen = n => leap(n) ? 669 : 668;

export const MY_MIN = -60;                                    // ~1844
const LIMIT = msdFromMs(Date.UTC(2201, 0, 1));
export const astro = {};
export let MY_MAX = 1;
for (let n = MY_MIN; ; n++) {
  astro[n] = boundary(n, 0);
  if (astro[n] >= LIMIT) { MY_MAX = n - 1; break; }
}

/** Whole-sol year starts (worldbuilder calendar): MSD of sol 1 of each year. */
export const wb = { 1: Math.floor(astro[1]) };
for (let n = 2; n <= MY_MAX + 1; n++) wb[n] = wb[n - 1] + yearLen(n - 1);
for (let n = 0; n >= MY_MIN; n--) wb[n] = wb[n + 1] - yearLen(n);

export function yearOfSol(m) {
  if (m < wb[MY_MIN] || m >= wb[MY_MAX + 1]) return null;
  let n = 1 + Math.floor((m - wb[1]) / 668.6);
  while (m < wb[n]) n--;
  while (m >= wb[n + 1]) n++;
  return n;
}

export function monthLengths(n) {
  const l = MONTH_LEN.slice();
  if (leap(n)) l[11]++;
  return l;
}

/** Integer sol → calendar date. */
export function marsDate(m) {
  const my = yearOfSol(m);
  if (my == null) return null;
  let r = m - wb[my];
  const lens = monthLengths(my);
  let month = 0;
  while (r >= lens[month]) { r -= lens[month]; month++; }
  return { my, month: month + 1, sol: r + 1, solOfYear: m - wb[my] + 1, weekday: mod(m - wb[1], 7) };
}

export function solFromMarsDate(my, month, sol) {
  if (!(my >= MY_MIN && my <= MY_MAX)) return null;
  const lens = monthLengths(my);
  if (!(month >= 1 && month <= 12) || !(sol >= 1 && sol <= lens[month - 1])) return null;
  return wb[my] + lens.slice(0, month - 1).reduce((a, b) => a + b, 0) + sol - 1;
}
