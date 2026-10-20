export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export type CalendarView = 'month' | 'week' | 'day';

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type PeriodId = 'morning' | 'lunch' | 'afternoon' | 'evening';

export type PatternId = 'every' | 'even' | 'odd';

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

export interface Availability {
  id: number;
  day: DayId;
  period: PeriodId;
  pattern: PatternId;
}

export interface AvailabilityDraft {
  day: DayId;
  period: PeriodId;
  pattern: PatternId;
}

export interface Member {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  color: string;
  missionIds: number[];
  availabilities: Availability[];
}

export interface MemberDraft {
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  color: string;
  missionIds: number[];
  availabilities: AvailabilityDraft[];
}

export interface Mission {
  id: number;
  name: string;
  emoji: string | null;
  slots?: MissionSlot[];
  memberIds?: number[];
}

export interface MissionSlot {
  id: number;
  missionId: number;
  day: DayId;
  startTime: string;
  endTime: string;
}

export interface Assignment {
  id: number;
  eventId: number;
  memberId: number;
  occurrence: string | null;
}
