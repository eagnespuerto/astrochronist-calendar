// Now-tab backgrounds from the NASA Image and Video Library (images.nasa.gov).
// Hand-picked IDs per time system; files are resolved through the public API at runtime.
const SETS = {
  // Earth must fill the frame here; Earthrise/Earthset shots are mostly Moon, so they live in `lunar`.
  greg: ["as17-148-22727", "iss045e013851", "iss042e340851"],
  mars: ["PIA24921", "PIA24264", "PIA24765", "PIA24422"],
  lunar: ["as11-40-5875", "as11-40-5903", "jsc2004e52772", "as08-14-2383", "art002e021278"],
  "bjd-sgra": ["PIA13932", "PIA17009", "PIA03653", "PIA12348"],
  "bjd-acen": ["GSFC_20171208_Archive_e000214", "sts075-351-022"],
};
const API = "https://images-api.nasa.gov";
const memo = new Map();

async function resolve(id) {
  if (memo.has(id)) return memo.get(id);
  const ss = `nasaimg:${id}`;
  try { const c = JSON.parse(sessionStorage.getItem(ss)); if (c) { memo.set(id, c); return c; } } catch { /* ignore */ }
  const [asset, meta] = await Promise.all([
    fetch(`${API}/asset/${encodeURIComponent(id)}`).then(r => r.json()),
    fetch(`${API}/search?nasa_id=${encodeURIComponent(id)}`).then(r => r.json()),
  ]);
  const hrefs = asset.collection.items.map(i => i.href);
  const pick = ["~large.jpg", "~medium.jpg", "~orig.jpg"].map(s => hrefs.find(h => h.endsWith(s))).find(Boolean);
  if (!pick) throw new Error("no image file for " + id);
  const d = meta.collection.items[0]?.data[0] || {};
  const out = {
    id, url: pick.replace(/^http:/, "https:"), title: d.title || id,
    credit: d.secondary_creator || d.photographer || (d.center ? `NASA ${d.center}` : "NASA"),
  };
  memo.set(id, out);
  try { sessionStorage.setItem(ss, JSON.stringify(out)); } catch { /* ignore */ }
  return out;
}

let token = 0;
const lastIdx = {};

/** Fade a new photo for this system into `bg`, and update the credit link. */
export async function showBackground(sysId, bg, creditEl, next = false) {
  const set = SETS[sysId] || SETS.greg, my = ++token;
  let i = lastIdx[sysId] ?? Math.floor(Math.random() * set.length);
  if (next) i = (i + 1) % set.length;
  lastIdx[sysId] = i;
  bg.classList.remove("on");
  try {
    const img = await resolve(set[i]);
    await new Promise((ok, fail) => { const im = new Image(); im.onload = ok; im.onerror = fail; im.src = img.url; });
    if (my !== token) return;
    bg.style.backgroundImage = `url("${img.url}")`;
    bg.classList.add("on");
    creditEl.textContent = `${img.title} · ${img.credit} · images.nasa.gov`;
    creditEl.href = `https://images.nasa.gov/details/${encodeURIComponent(img.id)}`;
  } catch {
    if (my !== token) return;
    bg.style.backgroundImage = "";
    creditEl.textContent = "";
    creditEl.removeAttribute("href");
  }
}
