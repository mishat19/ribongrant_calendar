import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import Storage from 'expo-sqlite/kv-store';
import type { CalendarView } from '../domain/types';

interface SettingsState {
  view: CalendarView;
  setView: (view: CalendarView) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      view: 'month',
      setView: (view) => set({ view }),
    }),
    {
      name: 'calendar-settings',
      storage: createJSONStorage(() => Storage),
    }
  )
);
