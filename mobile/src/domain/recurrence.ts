import { addDays, addMonths, isSameDay, startOfDay } from 'date-fns';
import type { CalEvent, Occurrence } from './types';

const MAX_OCCURRENCES = 400;

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function occurrenceEnd(start: Date, event: CalEvent): Date {
  const originalStart = new Date(event.start);
  const originalEnd = event.end ? new Date(event.end) : originalStart;
  const rawMs = originalEnd.getTime() - originalStart.getTime();
  const fallbackMs = event.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const durationMs = rawMs > 0 ? rawMs : fallbackMs;
  return new Date(start.getTime() + durationMs);
}

export function expandEvent(event: CalEvent, rangeFrom: Date, rangeTo: Date): Occurrence[] {
  const originalStart = new Date(event.start);
  const until = event.recurrenceUntil ? startOfDay(new Date(event.recurrenceUntil)) : null;
  const results: Occurrence[] = [];

  const pushIfInRange = (start: Date) => {
    if (until && startOfDay(start) > until) return false;
    const end = occurrenceEnd(start, event);
    if (start <= rangeTo && end >= rangeFrom) {
      results.push({ eventId: event.id, start, end, allDay: event.allDay });
    }
    return true;
  };

  if (event.recurrence === 'none') {
    pushIfInRange(originalStart);
    return results;
  }

  let cursor = originalStart;
  let guard = 0;
  while (guard < MAX_OCCURRENCES && cursor <= rangeTo) {
    if (until && startOfDay(cursor) > until) break;
    pushIfInRange(cursor);
    if (event.recurrence === 'daily') {
      cursor = addDays(cursor, 1);
    } else if (event.recurrence === 'weekly') {
      cursor = addDays(cursor, 7);
    } else {
      const day = originalStart.getDate();
      const next = addMonths(cursor, 1);
      // Keep the original day-of-month intent; clamp to shorter months.
      cursor = new Date(next.getFullYear(), next.getMonth(), Math.min(day, daysInMonth(next)), originalStart.getHours(), originalStart.getMinutes());
    }
    guard += 1;
  }

  return results;
}

export function expandEvents(events: CalEvent[], rangeFrom: Date, rangeTo: Date): Occurrence[] {
  const occurrences: Occurrence[] = [];
  for (const event of events) {
    occurrences.push(...expandEvent(event, rangeFrom, rangeTo));
  }
  occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());
  return occurrences;
}

export function sameDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}
