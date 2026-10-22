// Tab routing by URL hash: #now (default), #calendar, #science, #about.
import { initNow, showNow } from "./ui/now.js";
import { initCalendar, showCalendar, rerenderCalendar } from "./ui/calendar.js";
import { initScience, showScience } from "./ui/science.js";

const TABS = ["now", "calendar", "science", "about"];

function route() {
  const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "now";
  for (const t of TABS) document.getElementById("tab-" + t).hidden = t !== tab;
  document.querySelectorAll("nav a").forEach(a => { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  document.body.classList.toggle("on-now", tab === "now");
  showNow(tab === "now");
  showCalendar(tab === "calendar");
  showScience(tab === "science");
  if (tab === "science" || tab === "about") document.body.dataset.sys = "greg";
  const names = { now: "Now", calendar: "Calendar", science: "Science", about: "About" };
  document.title = tab === "now" ? "Astrochronist Calendar" : `${names[tab]} · Astrochronist Calendar`;
  window.scrollTo(0, 0);
}

initNow();
initScience(rerenderCalendar);
initCalendar();
window.addEventListener("hashchange", route);
route();
