// Now tab: a homepage clock for one time system at a time, over a NASA photo.
import { SYSTEMS, byId } from "../systems.js";
import { sunTimes, meanSolarFrac } from "../time/solar.js";
import { hms } from "../time/core.js";
import { prefs, setPref, $, esc, radioButtons } from "./prefs.js";
import { showBackground } from "./backgrounds.js";

let sys = byId(prefs().nowSys || "greg");
let geo = prefs().geo || null;           // {lat, lon}, rounded to 0.01°
let active = false;
const fHM = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fLocal = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });

function tick() {
  if (!active) return;
  const now = Date.now(), p = sys.now(now, geo);
  $("nowTime").textContent = p.time;
  $("nowNote").textContent = p.timeNote;
  $("kiloChip").hidden = !p.kilo;
  $("kiloChip").parentElement.classList.toggle("four", !!p.kilo);
  for (const k of ["day", "month", "kilo", "year"]) {
    if (!p[k]) continue;
    const K = k[0].toUpperCase() + k.slice(1);
    $("u" + K).textContent = sys.unit[k];
    $("n" + K).textContent = p[k].v;
    $("n" + K + "Sub").textContent = p[k].sub;
  }
  $("nowExtras").innerHTML = p.extras.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("");
  $("hereLocal").textContent = sys.id === "greg" ? "" : `Your local time: ${fLocal.format(now)}`;
  if (geo) {
    const s = sunTimes(now, geo.lat, geo.lon);
    const app = meanSolarFrac(now, geo.lon) + s.eotMin / 1440;
    const sun = s.polar ? s.polar : `sunrise ${fHM.format(s.rise)} · sunset ${fHM.format(s.set)}`;
    $("hereGeo").textContent = `${Math.abs(geo.lat).toFixed(2)}°${geo.lat >= 0 ? "N" : "S"} ${Math.abs(geo.lon).toFixed(2)}°${geo.lon >= 0 ? "E" : "W"} · solar time ${hms(app).slice(0, 5)} (mean ${hms(meanSolarFrac(now, geo.lon)).slice(0, 5)}) · ${sun}`;
  }
}

function pick(id) {
  sys = byId(id);
  setPref("nowSys", id);
  document.body.dataset.sys = id;
  showBackground(id, $("bg"), $("credit"));
  tick();
}

function locate() {
  if (!navigator.geolocation) { $("hereGeo").textContent = "Location isn't available in this browser."; return; }
  $("geoBtn").disabled = true;
  navigator.geolocation.getCurrentPosition(pos => {
    geo = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) };
    setPref("geo", geo);
    $("geoBtn").hidden = true;
    tick();
  }, err => {
    $("geoBtn").disabled = false;
    $("hereGeo").textContent = err.code === 1 ? "Location permission was declined." : "Couldn't get your location.";
  }, { maximumAge: 6 * 3600e3, timeout: 15000 });
}

export function initNow() {
  radioButtons($("nowSys"), SYSTEMS.map(s => ({ id: s.id, label: s.menu })), sys.id, pick);
  $("geoBtn").onclick = locate;
  $("shuffle").onclick = () => showBackground(sys.id, $("bg"), $("credit"), true);
  if (geo) $("geoBtn").hidden = true;
  setInterval(tick, 250);
}

export function showNow(on) {
  active = on;
  if (on) {
    document.body.dataset.sys = sys.id;
    if (!$("bg").style.backgroundImage) showBackground(sys.id, $("bg"), $("credit"));
    tick();
  }
}
