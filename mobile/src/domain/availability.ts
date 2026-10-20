import type { DayId, Member, PatternId, PeriodId } from './types';

export const DAYS: { id: DayId; label: string; short: string; jsDay: number }[] = [
  { id: 'mon', label: 'Lundi', short: 'Lun', jsDay: 1 },
  { id: 'tue', label: 'Mardi', short: 'Mar', jsDay: 2 },
  { id: 'wed', label: 'Mercredi', short: 'Mer', jsDay: 3 },
  { id: 'thu', label: 'Jeudi', short: 'Jeu', jsDay: 4 },
  { id: 'fri', label: 'Vendredi', short: 'Ven', jsDay: 5 },
  { id: 'sat', label: 'Samedi', short: 'Sam', jsDay: 6 },
  { id: 'sun', label: 'Dimanche', short: 'Dim', jsDay: 0 },
];

export const PERIODS: { id: PeriodId; label: string; from: number; to: number }[] = [
  { id: 'morning', label: 'Matin', from: 6, to: 12 },
  { id: 'lunch', label: 'Midi', from: 12, to: 14 },
  { id: 'afternoon', label: 'Après-midi', from: 14, to: 18 },
  { id: 'evening', label: 'Soir', from: 18, to: 22 },
];

export const PATTERNS: { id: PatternId; label: string; short: string }[] = [
  { id: 'every', label: 'Chaque semaine', short: 'Toutes' },
  { id: 'even', label: 'Semaines paires', short: 'Paires' },
  { id: 'odd', label: 'Semaines impaires', short: 'Impaires' },
];

export function dayLabel(id: DayId): string {
  return DAYS.find((d) => d.id === id)?.label ?? id;
}

export function dayShort(id: DayId): string {
  return DAYS.find((d) => d.id === id)?.short ?? id;
}

export function periodLabel(id: PeriodId): string {
  return PERIODS.find((p) => p.id === id)?.label ?? id;
}

export function patternLabel(id: PatternId): string {
  return PATTERNS.find((p) => p.id === id)?.label ?? id;
}

export function dayIdFromJsDay(jsDay: number): DayId | null {
  return DAYS.find((d) => d.jsDay === jsDay)?.id ?? null;
}

export function periodForDate(date: Date): PeriodId {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 12) return 'morning';
  if (h < 14) return 'lunch';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function parityForDate(date: Date): PatternId {
  return isoWeek(date) % 2 === 0 ? 'even' : 'odd';
}

export function slotForDate(date: Date, ignorePeriod = false) {
  return {
    day: dayIdFromJsDay(date.getDay()),
    period: ignorePeriod ? null : periodForDate(date),
    parity: parityForDate(date),
  };
}

export function isAvailable(member: Member, date: Date, ignorePeriod = false): boolean {
  const { day, period, parity } = slotForDate(date, ignorePeriod);
  return member.availabilities.some(
    (a) =>
      a.day === day &&
      (period === null || a.period === period) &&
      (a.pattern === 'every' || a.pattern === parity)
  );
}

export function eligibleMembers(members: Member[], date: Date, ignorePeriod = false): Member[] {
  return members.filter((m) => isAvailable(m, date, ignorePeriod));
}

export function formatAvailabilities(member: Member): string[] {
  return member.availabilities.map(
    (a) => `${dayShort(a.day)} · ${periodLabel(a.period)} · ${patternLabel(a.pattern)}`
  );
}
