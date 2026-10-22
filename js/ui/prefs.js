// Per-browser conveniences (chosen systems, planner inputs). Safe when storage is blocked.
const KEY = "astrochronist.v1";
let cache = null;

export function prefs() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { cache = {}; }
  return cache;
}

export function setPref(k, v) {
  prefs()[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage unavailable */ }
}

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Build a row of radio-style buttons. */
export function radioButtons(el, items, current, onPick) {
  el.textContent = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.id = it.id;
    b.textContent = it.label;
    b.setAttribute("aria-checked", String(it.id === current));
    b.onclick = () => {
      el.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
      onPick(it.id);
    };
    el.append(b);
  }
}
