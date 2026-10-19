export const DAYS = [
  { id: "mon", label: "Lundi", jsDay: 1 },
  { id: "tue", label: "Mardi", jsDay: 2 },
  { id: "wed", label: "Mercredi", jsDay: 3 },
  { id: "thu", label: "Jeudi", jsDay: 4 },
  { id: "fri", label: "Vendredi", jsDay: 5 },
  { id: "sat", label: "Samedi", jsDay: 6 },
  { id: "sun", label: "Dimanche", jsDay: 0 },
];

export const PERIODS = [
  { id: "morning", label: "Matin", from: 6, to: 12 },
  { id: "lunch", label: "Midi", from: 12, to: 14 },
  { id: "afternoon", label: "Après-midi", from: 14, to: 18 },
  { id: "evening", label: "Soir", from: 18, to: 22 },
];

export const PATTERNS = [
  { id: "every", label: "Chaque semaine" },
  { id: "even", label: "Semaines paires" },
  { id: "odd", label: "Semaines impaires" },
];

export const dayLabel = (id) => DAYS.find((d) => d.id === id)?.label || id;
export const periodLabel = (id) => PERIODS.find((p) => p.id === id)?.label || id;
export const patternLabel = (id) => PATTERNS.find((p) => p.id === id)?.label || id;

export function parseDate(value) {
  if (!value) return null;
  if (typeof value === "string" && value.length <= 10) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}

export function jsDayToId(jsDay) {
  return DAYS.find((d) => d.jsDay === jsDay)?.id;
}

export function periodForDate(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 12) return "morning";
  if (h < 14) return "lunch";
  if (h < 18) return "afternoon";
  return "evening";
}

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function parityForDate(date) {
  return isoWeek(date) % 2 === 0 ? "even" : "odd";
}

export function slotForDate(date, ignorePeriod = false) {
  const d = parseDate(date) || new Date();
  return {
    day: jsDayToId(d.getDay()),
    period: ignorePeriod ? null : periodForDate(d),
    parity: parityForDate(d),
  };
}

export function isAvailable(member, date, { ignorePeriod = false } = {}) {
  const { day, period, parity } = slotForDate(date, ignorePeriod);
  return (member.availabilities || []).some(
    (a) =>
      a.day === day &&
      (period === null || a.period === period) &&
      (a.pattern === "every" || a.pattern === parity),
  );
}

export function eligibleMembers(members, date, ignorePeriod = false) {
  return members.filter((m) => isAvailable(m, date, { ignorePeriod }));
}
