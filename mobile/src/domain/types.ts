export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export type CalendarView = 'month' | 'week' | 'day';

export interface CalEvent {
  id: number;
  title: string;
  description: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  color: string;
  recurrence: Recurrence;
  recurrenceUntil: string | null;
  reminderMinutes: number | null;
  notificationIds: string[];
}

export interface EventDraft {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  recurrence: Recurrence;
  recurrenceUntil: Date | null;
  reminderMinutes: number | null;
}

export interface Occurrence {
  eventId: number;
  start: Date;
  end: Date;
  allDay: boolean;
}
