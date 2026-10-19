import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { CalendarView } from './types';

export const WEEK_STARTS_ON = 1;

export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function weekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function rangeForView(cursor: Date, view: CalendarView): { from: Date; to: Date } {
  if (view === 'month') {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    return { from: start, to: end };
  }
  if (view === 'week') {
    return { from: weekStart(cursor), to: weekEnd(cursor) };
  }
  return { from: startOfDay(cursor), to: endOfDay(cursor) };
}

export function monthGrid(cursor: Date): Date[] {
  const { from, to } = rangeForView(cursor, 'month');
  const days: Date[] = [];
  let day = from;
  while (day <= to) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

export function weekDays(cursor: Date): Date[] {
  const start = weekStart(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function addPeriod(cursor: Date, view: CalendarView, delta: number): Date {
  if (view === 'month') return addMonths(cursor, delta);
  if (view === 'week') return addDays(cursor, 7 * delta);
  return addDays(cursor, delta);
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

export function headerTitle(cursor: Date, view: CalendarView): string {
  if (view === 'month') {
    return capitalize(format(cursor, 'MMMM yyyy', { locale: fr }));
  }
  if (view === 'day') {
    return capitalize(format(cursor, 'EEEE d MMMM', { locale: fr }));
  }
  const start = weekStart(cursor);
  const end = weekEnd(cursor);
  if (isSameMonth(start, end)) {
    return `${format(start, 'd')} – ${format(end, 'd MMMM yyyy', { locale: fr })}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy', { locale: fr })}`;
  }
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy', { locale: fr })}`;
}

export function dayNumberStyle(day: Date, today: Date) {
  return {
    isToday: isSameDay(day, today),
    isCurrentMonth: isSameMonth(day, today),
    isWeekend: day.getDay() === 0 || day.getDay() === 6,
  };
}

export function formatEventTime(start: Date, end: Date, allDay: boolean): string {
  if (allDay) return format(start, 'EEEE d MMMM', { locale: fr });
  const sameDay = isSameDay(start, end);
  const startText = format(start, sameDay ? 'HH:mm' : 'EEEE d MMM HH:mm', { locale: fr });
  const endText = format(end, 'HH:mm', { locale: fr });
  return `${startText} – ${endText}`;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function atMinutes(day: Date, minutes: number): Date {
  const result = startOfDay(day);
  result.setMinutes(minutes);
  return result;
}

export function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export { isSameDay, format, addDays, startOfDay, endOfDay };
