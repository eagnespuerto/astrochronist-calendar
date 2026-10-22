// Sun times for a place on Earth (sunrise equation, good to a minute or two).
import { D2R, jdFromMs, msFromJd, mod } from "./core.js";

/**
 * @param ms   any instant on the local day of interest
 * @param lat  latitude, degrees north
 * @param lon  longitude, degrees east
 * @returns {{noon:number, rise:number|null, set:number|null, eotMin:number, polar:string|null}}
 */
export function sunTimes(ms, lat, lon) {
  const n = Math.round(jdFromMs(ms) - 2451545.0008 + lon / 360);
  const J = n - lon / 360;
  const M = mod(357.5291 + 0.98560028 * J, 360) * D2R;
  const C = 1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M);
  const lam = mod(M / D2R + C + 180 + 102.9372, 360) * D2R;
  const transit = 2451545 + J + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lam);
  const sinD = Math.sin(lam) * Math.sin(23.4397 * D2R), cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * D2R) - Math.sin(lat * D2R) * sinD) / (Math.cos(lat * D2R) * cosD);
  const eotMin = ((2451545 + J) - transit) * 1440;
  const out = { noon: msFromJd(transit), rise: null, set: null, eotMin, polar: null };
  if (cosW > 1) out.polar = "polar night";
  else if (cosW < -1) out.polar = "midnight sun";
  else {
    const w = Math.acos(cosW) / D2R / 360;
    out.rise = msFromJd(transit - w);
    out.set = msFromJd(transit + w);
  }
  return out;
}

/** Local mean solar time as a day fraction. */
export const meanSolarFrac = (ms, lon) => mod(jdFromMs(ms) + 0.5 + lon / 360, 1);
