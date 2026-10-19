import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { CalEvent, EventDraft } from '../domain/types';
import {
  deleteEvent as dbDeleteEvent,
  insertEvent,
  listEventsInRange,
  updateEvent,
} from '../db/database';
import { cancelReminders, scheduleReminders } from '../lib/notifications';

interface EventsState {
  events: CalEvent[];
  loading: boolean;
  loadRange: (db: SQLiteDatabase, from: Date, to: Date) => Promise<void>;
  createEvent: (db: SQLiteDatabase, draft: EventDraft) => Promise<CalEvent>;
  editEvent: (db: SQLiteDatabase, id: number, draft: EventDraft) => Promise<CalEvent>;
  removeEvent: (db: SQLiteDatabase, event: CalEvent) => Promise<void>;
}

export const useEventsStore = create<EventsState>((set) => ({
  events: [],
  loading: false,

  loadRange: async (db, from, to) => {
    set({ loading: true });
    try {
      const events = await listEventsInRange(db, from, to);
      set({ events, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createEvent: async (db, draft) => {
    const ids = await scheduleReminders(draft);
    const event = await insertEvent(db, draft, ids);
    set((state) => ({ events: [...state.events, event] }));
    return event;
  },

  editEvent: async (db, id, draft) => {
    const previous = useEventsStore.getState().events.find((e) => e.id === id);
    if (previous) await cancelReminders(previous.notificationIds);
    const ids = await scheduleReminders({ ...draft, id });
    const event = await updateEvent(db, id, draft, ids);
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? event : e)),
    }));
    return event;
  },

  removeEvent: async (db, event) => {
    await cancelReminders(event.notificationIds);
    await dbDeleteEvent(db, event.id);
    set((state) => ({ events: state.events.filter((e) => e.id !== event.id) }));
  },
}));
