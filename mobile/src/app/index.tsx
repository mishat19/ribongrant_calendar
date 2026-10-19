import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOfDay } from 'date-fns';
import { CalendarHeader } from '../components/CalendarHeader';
import { MonthView, groupByDayKey } from '../components/MonthView';
import { TimeView } from '../components/TimeView';
import { SwipePager } from '../components/SwipePager';
import { EventSheet } from '../components/EventSheet';
import type { EventItem } from '../components/EventBlock';
import { addPeriod, atMinutes, headerTitle, rangeForView } from '../domain/dates';
import { expandEvents } from '../domain/recurrence';
import { useEventsStore } from '../store/eventsStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme';

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const view = useSettingsStore((s) => s.view);
  const setView = useSettingsStore((s) => s.setView);
  const events = useEventsStore((s) => s.events);
  const loadRange = useEventsStore((s) => s.loadRange);
  const removeEvent = useEventsStore((s) => s.removeEvent);

  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<EventItem | null>(null);

  const { from, to } = useMemo(() => rangeForView(cursor, view), [cursor, view]);

  useEffect(() => {
    loadRange(db, from, to);
  }, [db, from, to, loadRange]);

  const occurrences = useMemo(() => expandEvents(events, from, to), [events, from, to]);
  const itemsByDayKey = useMemo(() => groupByDayKey(occurrences.map((o) => ({
    event: events.find((e) => e.id === o.eventId)!,
    occurrence: o,
  })).filter((item) => item.event)), [occurrences, events]);

  const openCreate = useCallback((start: Date, allDay = false) => {
    const startDate = startOfDay(start);
    const endDate = allDay
      ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      : new Date((allDay ? startDate : start).getTime() + 60 * 60 * 1000);
    router.push({
      pathname: '/event',
      params: {
        start: (allDay ? startDate : start).toISOString(),
        end: endDate.toISOString(),
        allDay: allDay ? '1' : '0',
      },
    });
  }, []);

  const openEdit = useCallback((item: EventItem | { event: import('../domain/types').CalEvent }) => {
    setSelected(null);
    router.push({ pathname: '/event', params: { id: String(item.event.id) } });
  }, []);

  const onDelete = useCallback(
    async (item: EventItem) => {
      setSelected(null);
      await removeEvent(db, item.event);
    },
    [db, removeEvent]
  );

  const onSlotPress = useCallback(
    (day: Date, minutes: number) => openCreate(atMinutes(day, minutes)),
    [openCreate]
  );

  const goPrev = useCallback(() => setCursor((c) => addPeriod(c, view, -1)), [view]);
  const goNext = useCallback(() => setCursor((c) => addPeriod(c, view, 1)), [view]);
  const goToday = useCallback(() => setCursor(startOfDay(new Date())), []);

  const onDayPress = useCallback(
    (day: Date) => {
      if (view === 'month') {
        setCursor(startOfDay(day));
        setView('day');
      } else if (view === 'week') {
        setCursor(startOfDay(day));
        setView('day');
      }
    },
    [view, setView]
  );

  const handleEventForSheet = setSelected;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <CalendarHeader
        title={headerTitle(cursor, view)}
        view={view}
        theme={theme}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onViewChange={setView}
        onSearch={() => router.push('/search')}
      />
      <SwipePager onNext={goNext} onPrev={goPrev} style={styles.pager}>
        {view === 'month' ? (
          <MonthView
            cursor={cursor}
            itemsByDayKey={itemsByDayKey}
            theme={theme}
            onDayPress={onDayPress}
            onEventPress={handleEventForSheet}
          />
        ) : (
          <TimeView
            cursor={cursor}
            mode={view === 'week' ? 'week' : 'day'}
            itemsByDayKey={itemsByDayKey}
            theme={theme}
            onSlotPress={onSlotPress}
            onEventPress={handleEventForSheet}
          />
        )}
      </SwipePager>

      <Pressable
        onPress={() => openCreate(new Date())}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom: 24 + insets.bottom,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons name="plus" size={28} color={theme.onPrimary} />
      </Pressable>

      <EventSheet
        item={selected}
        theme={theme}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onDelete={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
