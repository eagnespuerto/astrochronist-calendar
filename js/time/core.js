// Shared time constants and helpers. All instants are Unix milliseconds (UTC).

export const DAY_MS = 86400000;
export const JD_UNIX = 2440587.5;          // JD at 1970-01-01 00:00 UTC
export const TT_UTC = 69.184;              // TT − UTC in seconds (37 leap s + 32.184 s)
export const TT_DAYS = TT_UTC / 86400;
export const D2R = Math.PI / 180;

export const jdFromMs = ms => ms / DAY_MS + JD_UNIX;
export const msFromJd = jd => (jd - JD_UNIX) * DAY_MS;
export const mod = (a, b) => ((a % b) + b) % b;
export const pad = (v, n = 2) => String(v).padStart(n, "0");
export const fmt = n => n.toLocaleString("en-US");
export const nf = (x, p) => x.toLocaleString("en-US", { minimumFractionDigits: p, maximumFractionDigits: p });

/** Day fraction (0..1) → "hh:mm:ss" on a 24-hour face. */
export function hms(frac) {
  const t = Math.floor(mod(frac, 1) * 86400 + 1e-6);
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
}

/** Local-time instant for a calendar date, safe for years below 100. */
export function localMs(y, m, d, h = 0, mi = 0, s = 0) {
  const t = new Date(2000, 0, 1);
  t.setFullYear(y, m, d);
  t.setHours(h, mi, s, 0);
  return t.getTime();
}

export function utcMs(y, m, d, h = 0, mi = 0, s = 0) {
  const t = new Date(Date.UTC(2000, 0, 1));
  t.setUTCFullYear(y, m, d);
  t.setUTCHours(h, mi, s, 0);
  return t.getTime();
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const UTC = { timeZone: "UTC" };
export const fmtUTCDate = new Intl.DateTimeFormat("en-GB", { ...UTC, day: "numeric", month: "short", year: "numeric" });
export const fmtUTCShort = new Intl.DateTimeFormat("en-GB", { ...UTC, day: "numeric", month: "short" });
export const fmtUTCFull = new Intl.DateTimeFormat("en-GB", { ...UTC, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export const fmtLocalFull = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
export const isoUTC = ms => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
