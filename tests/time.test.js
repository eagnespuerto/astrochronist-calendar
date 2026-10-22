import test from "node:test";
import assert from "node:assert/strict";
import * as Mars from "../js/time/mars.js";
import { BASES, bjd, utcFromBjd, corrSec } from "../js/time/bary.js";
import { lst, msFromLst, LST_EPOCH, moonPhase } from "../js/time/lunar.js";
import { sunTimes } from "../js/time/solar.js";
import { jdFromMs } from "../js/time/core.js";
import { SYSTEMS, mars, lunar } from "../js/systems.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

test("Mars Sol Date matches Allison & McEwen worked example", () => {
  // 2000-01-06 00:00 UTC → MSD 44795.9998 (with TT−UTC = 64.184 s then; we use 69.184 s, ~0.00006 sol off)
  near(Mars.msdFromMs(Date.UTC(2000, 0, 6)), 44795.9998, 2e-4, "MSD");
});

test("Mars solar longitude matches Mars24 example", () => {
  near(Mars.ls(Mars.msdFromMs(Date.UTC(2000, 0, 6))), 277.1876, 0.01, "Ls");
});

test("Mars Year 1 starts on the 1955 equinox and MY 38 in November 2024", () => {
  // The equinox falls on 11 April; sol 1 is the sol containing it.
  assert.equal(new Date(Mars.msFromMsd(Mars.astro[1])).toISOString().slice(0, 10), "1955-04-11");
  assert.ok(Mars.wb[1] <= Mars.astro[1] && Mars.astro[1] < Mars.wb[1] + 1);
  const my38 = new Date(Mars.msFromMsd(Mars.astro[38])).toISOString().slice(0, 10);
  assert.ok(["2024-11-12", "2024-11-13"].includes(my38), my38);
});

test("Mars dates round-trip and years have 668/669 sols", () => {
  for (const n of [-10, 0, 1, 37, 38, 100]) {
    const lay = mars.layout(n), cells = lay.months.flatMap(m => m.cells);
    assert.equal(cells.length, Mars.yearLen(n));
    for (let i = 1; i < cells.length; i++) assert.equal(cells[i].start, cells[i - 1].end);
  }
  const m = Mars.solFromMarsDate(38, 7, 12);
  assert.deepEqual(Object.values(Mars.marsDate(m)).slice(0, 3), [38, 7, 12]);
});

test("BJD round-trips and the correction stays under one light-AU", () => {
  for (const b of Object.values(BASES)) for (const jd of [2451545, 2460000.3, 2461337.8]) {
    const B = bjd(jd, b);
    near(utcFromBjd(B, b), jd, 1e-8, "round trip");
    assert.ok(Math.abs(corrSec(jd, b.ra, b.dec)) < 505);
  }
});

test("Lunar Standard Time epoch is Apollo 11 first step", () => {
  assert.equal(LST_EPOCH, Date.UTC(1969, 6, 21, 2, 56, 15));
  const p = lst(LST_EPOCH);
  assert.deepEqual([p.year, p.day, p.cycle], [1, 1, 1]);
  const t = Date.UTC(2026, 9, 23, 12);
  const q = lst(t);
  near(msFromLst(q.year, q.day, q.cycle, q.frac), t, 1, "round trip");
  const lay = lunar.layout(q.year).months.flatMap(m => m.cells);
  assert.equal(lay.length, 360);
  near(lay[359].end - lay[0].start, 12 * 29.530588853 * 864e5, 1, "year length");
});

test("Mean moon phase is near new on 2000-01-06 and full on 2000-01-21", () => {
  assert.ok(moonPhase(Date.UTC(2000, 0, 6, 18)).illum < 0.01);
  assert.ok(moonPhase(Date.UTC(2000, 0, 21, 5)).illum > 0.98);
});

test("Sunrise in Greenwich on the 2024 June solstice is near 03:43 UTC", () => {
  const s = sunTimes(Date.UTC(2024, 5, 20, 12), 51.4769, 0);
  near((s.rise - Date.UTC(2024, 5, 20)) / 6e4, 3 * 60 + 43, 4, "sunrise minutes");
});

test("Every system's layout is contiguous and contains its own instants", () => {
  const t = Date.UTC(2026, 9, 23, 15);
  for (const sys of SYSTEMS) {
    const y = sys.yearOf(t), cells = sys.layout(y).months.flatMap(m => m.cells);
    for (let i = 1; i < cells.length; i++) near(cells[i].start, cells[i - 1].end, 1, sys.id + " gap");
    assert.ok(cells.some(c => t >= c.start && t < c.end), sys.id + " contains now");
    assert.ok(sys.parse && sys.placeholder, sys.id);
  }
});

test("Parsers accept their placeholders", () => {
  for (const sys of SYSTEMS) {
    const ex = sys.placeholder.split(/ or |, or /)[0];
    const ms = sys.parse(ex);
    assert.ok(Number.isFinite(ms), `${sys.id} parses "${ex}"`);
  }
  near(jdFromMs(SYSTEMS[3].parse("2461340.5")), 2461340.5, 0.01, "BJD parse");
});
