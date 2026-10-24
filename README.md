# Astrochronist Calendar

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![made with](https://img.shields.io/badge/made%20with-JavaScript-F7DF1E?logo=javascript&logoColor=white)](https://github.com/eagnespuerto/astrochronist-calendar)
[![website](https://img.shields.io/badge/website-live-brightgreen)](https://eagnespuerto.github.io/astrochronist-calendar/)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support%20me-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/eagnespuerto)
[![Linktree](https://img.shields.io/badge/Linktree-soitsagnes-43E55E?logo=linktree&logoColor=white)](https://linktr.ee/soitsagnes)

Calendars and clocks counted from the sky instead of from Earth custom. A static site with no build step.

**Astrochronism** is the idea of basing time on astronomical things and events, especially those within our solar system, stellar neighbourhood, and galaxy, instead of arbitrary Earth events.

## Tabs

- **Now**: a homepage clock over a NASA photo. Switch between Gregorian (local and UTC), Martian (Mars Year, month, sol, Coordinated Mars Time), Lunar Standard Time, and barycentric days toward Sgr A\* or α Centauri. Share your location to add local solar time, sunrise and sunset, and Mars time at your longitude.
- **Calendar**: a year of month cards in the layout of the Mars Year calendar, for every system. Tap any day, sol or cycle to see its start and end in every other calendar. Switching calendars keeps your selection. "Go to" accepts a date written in the current system.
- **Science**: live time scales (JD, MJD, TT, BJD, MSD, MTC, Ls, LST, lunation), BJD and Mars details, exact Ls-based Martian month boundaries, and a transit and eclipse planner whose events can be marked on the calendar.
- **About**: what astrochronism is, how each system works, accuracy notes and credits.

## Systems

| System | Day | "Month" | "Year" | Epoch |
|---|---|---|---|---|
| Gregorian | civil day (local) | month | year | — |
| Martian | sol (Airy-0 midnight) | M1–M12, 30° of Ls each | Mars Year | MY 1 = 1955 northern spring equinox |
| Lunar Standard Time | cycle (24 lunar hours) | lunar day = 1 synodic month | 12 lunar days | 1969-07-21 02:56:15 UTC (Apollo 11 first step) |
| BJD · Sol–Sgr A\* | BJD_TDB day | hectoday (100 days), kiloday (1,000 days) | 365.25-day year; Year 1 starts at BJD 0.0 | BJD 0 |
| BJD · Sol–α Cen | BJD_TDB day | hectoday, kiloday | 365.25-day year | BJD 0 |

A BJD day belongs to the year it starts in, so years run 366, 365, 365, 365 days. The year number matches the Julian Period year (AD 2026 ≈ Year 6739).

## Run locally

ES modules need a web server (not `file://`):

```bash
python -m http.server 8090
```

Then open http://localhost:8090.

## Tests

The time math is plain ES modules tested with Node's built-in runner (Node 20+), checked against Mars24 / Allison & McEwen worked examples and known dates:

```bash
npm test
```

## Accuracy

Mars uses Allison & McEwen (2000). Barycentric corrections use a compact Earth orbit plus Jupiter and Saturn's pull on the Sun, good to about ±2 s. Lunar phases are mean phases (up to ~14 h off the true ones). TT − UTC is fixed at 69.184 s, so pre-1972 times can be off by up to a minute. Use astropy or JPL Horizons for publication-grade timing.

## Credits

- Background photos: [NASA Image and Video Library](https://images.nasa.gov/), loaded at runtime from its public API. NASA imagery is generally not copyrighted in the US; see the [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). No NASA endorsement is implied.
- Lunar Standard Time: Kenneth L. Lee (1970).
- Mars Year numbering: Clancy et al. (2000), Piqueux et al. (2015).

## License

MIT
