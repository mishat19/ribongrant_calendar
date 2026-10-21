import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWeekPlanningHtml } from "../src/lib/weekPlanningPdf.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const day = (d) => new Date(2026, 9, d);
const days = [21, 22, 23, 24, 25, 26, 27].map(day);

const PALETTE = ["#4285F4", "#EA4335", "#34A853", "#FBBC04", "#A142F4", "#24C1E0"];
const people = [
  "Camille Moreau",
  "Lucas Bernard",
  "Inès Petit",
  "Hugo Lambert",
  "Léa Fontaine",
  "Nathan Roux",
  "Chloé Garnier",
];
const colored = (name, i) => ({
  name,
  color: PALETTE[i % PALETTE.length],
});

const events = [
  {
    title: "Permanence d'accueil",
    color: "#1A73E8",
    start: new Date(2026, 9, 21, 0, 0),
    end: new Date(2026, 9, 22, 0, 0),
    allDay: true,
    assigned: [colored(people[0], 0), colored(people[1], 1)],
  },
  {
    title: "Réunion d'équipe",
    color: "#34A853",
    start: new Date(2026, 9, 21, 9, 0),
    end: new Date(2026, 9, 21, 10, 0),
    allDay: false,
    assigned: [0, 1, 2, 3, 4].map((i) => colored(people[i], i)),
  },
  {
    title: "Atelier/admin",
    color: "#EA4335",
    start: new Date(2026, 9, 22, 14, 0),
    end: new Date(2026, 9, 22, 15, 30),
    allDay: false,
    assigned: [1, 2, 3].map((i) => colored(people[i], i)),
  },
  {
    title: "Distribution",
    color: "#FBBC04",
    start: new Date(2026, 9, 23, 8, 30),
    end: new Date(2026, 9, 23, 11, 0),
    allDay: false,
    assigned: [0, 2, 4, 5].map((i) => colored(people[i], i)),
  },
  {
    title: "Point mensuel",
    color: "#A142F4",
    start: new Date(2026, 9, 24, 18, 0),
    end: new Date(2026, 9, 24, 19, 30),
    allDay: false,
    assigned: [0, 1, 3, 5, 6].map((i) => colored(people[i], i)),
  },
];

const html = buildWeekPlanningHtml({
  title: "Planning de la semaine 43",
  subtitle: "Du lundi 21 octobre 2026 au dimanche 27 octobre 2026",
  days,
  events,
});

fs.writeFileSync(path.join(here, "planning.html"), html);
console.log("html written");
