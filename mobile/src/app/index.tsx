import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endOfDay, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarHeader } from '../components/CalendarHeader';
import { BottomTabs, type TabId } from '../components/BottomTabs';
import { MonthView, groupByDayKey } from '../components/MonthView';
import { MembersView } from '../components/MembersView';
import { MemberForm } from '../components/MemberForm';
import { TimeView } from '../components/TimeView';
import { SwipePager } from '../components/SwipePager';
import { EventSheet } from '../components/EventSheet';
import { EventAssignSheet } from '../components/EventAssignSheet';
import type { EventItem } from '../components/EventBlock';
import { addPeriod, atMinutes, headerTitle, rangeForView, weekDays } from '../domain/dates';
import { expandEvents } from '../domain/recurrence';
import { eligibleMembers, isoWeek } from '../domain/availability';
import { dateKey, listEventsInRange } from '../db/database';
import { shareWeekPlanningPdf, type PdfEventEntry } from '../lib/weekPdf';
import { useEventsStore } from '../store/eventsStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTeamStore } from '../store/teamStore';
import { useTheme } from '../theme';
import type { Member } from '../domain/types';

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const view = useSettingsStore((s) => s.view);
  const setView = useSettingsStore((s) => s.setView);
  const events = useEventsStore((s) => s.events);
  const loadRange = useEventsStore((s) => s.loadRange);
  const removeEvent = useEventsStore((s) => s.removeEvent);
  const members = useTeamStore((s) => s.members);
  const loadTeam = useTeamStore((s) => s.load);
  const teamLoaded = useTeamStore((s) => s.loaded);

  const [tab, setTab] = useState<TabId>('calendar');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [assignItem, setAssignItem] = useState<EventItem | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberFormVisible, setMemberFormVisible] = useState(false);

  const { from, to } = useMemo(() => rangeForView(cursor, view), [cursor, view]);

  useEffect(() => {
    loadRange(db, from, to);
  }, [db, from, to, loadRange]);

  useEffect(() => {
    if (!teamLoaded) loadTeam(db).catch(() => undefined);
  }, [db, teamLoaded, loadTeam]);

  const occurrences = useMemo(() => expandEvents(events, from, to), [events, from, to]);
  const assignments = useTeamStore((s) => s.assignments);
  const itemsByDayKey = useMemo(
    () =>
      groupByDayKey(
        occurrences
          .map((o) => {
            const event = events.find((e) => e.id === o.eventId);
            if (!event) return null;
            const key = dateKey(o.start);
            const availableCount = eligibleMembers(members, o.start, event.allDay).length;
            const assignedNames = assignments
              .filter((a) => a.eventId === event.id && a.occurrence === key)
              .map((a) => members.find((m) => m.id === a.memberId)?.name)
              .filter((n): n is string => Boolean(n));
            return {
              event,
              occurrence: o,
              availableCount,
              totalMembers: members.length,
              assignedNames,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item != null)
      ),
    [occurrences, events, members, assignments]
  );

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

  const openEdit = useCallback((item: EventItem) => {
    setSelected(null);
    router.push({ pathname: '/event', params: { id: String(item.event.id) } });
  }, []);

  const openAssign = useCallback((item: EventItem) => {
    setSelected(null);
    setAssignItem(item);
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
      setCursor(startOfDay(day));
      setView('day');
    },
    [setView]
  );

  const openMemberForm = useCallback((member: Member | null) => {
    setEditingMember(member);
    setMemberFormVisible(true);
  }, []);

  const [exportingPdf, setExportingPdf] = useState(false);

  const shareWeekPdf = useCallback(async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const days = weekDays(cursor);
      const weekEvents = await listEventsInRange(db, days[0], endOfDay(days[6]));
      const weekOccurrences = expandEvents(weekEvents, days[0], endOfDay(days[6]));
      const entries: PdfEventEntry[] = [];
      for (const occurrence of weekOccurrences) {
        const event = weekEvents.find((e) => e.id === occurrence.eventId);
        if (!event) continue;
        const key = dateKey(occurrence.start);
        const assigned = assignments
          .filter((a) => a.eventId === event.id && a.occurrence === key)
          .map((a) => members.find((m) => m.id === a.memberId))
          .filter((m): m is Member => Boolean(m))
          .map((m) => ({ name: m.name, color: m.color }));
        entries.push({
          title: event.title,
          color: event.color,
          start: occurrence.start,
          end: occurrence.end,
          allDay: occurrence.allDay,
          availableCount: eligibleMembers(members, occurrence.start, occurrence.allDay).length,
          totalMembers: members.length,
          assigned,
        });
      }
      await shareWeekPlanningPdf({
        title: `Planning de la semaine ${isoWeek(days[0])}`,
        subtitle: `Du ${format(days[0], 'EEEE d MMMM yyyy', { locale: fr })} au ${format(
          days[6],
          'EEEE d MMMM yyyy',
          { locale: fr }
        )}`,
        days,
        events: entries,
      });
    } catch (err) {
      Alert.alert(
        'Export du planning',
        `Impossible de générer le PDF de la semaine.\n${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setExportingPdf(false);
    }
  }, [cursor, db, assignments, members, exportingPdf]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.body}>
        {tab === 'calendar' ? (
          <>
            <CalendarHeader
              title={headerTitle(cursor, view)}
              view={view}
              theme={theme}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
              onViewChange={setView}
              onSearch={() => router.push('/search')}
              onExportPdf={shareWeekPdf}
            />
            <SwipePager onNext={goNext} onPrev={goPrev} style={styles.pager}>
              {view === 'month' ? (
                <MonthView
                  cursor={cursor}
                  itemsByDayKey={itemsByDayKey}
                  theme={theme}
                  onDayPress={onDayPress}
                  onEventPress={setSelected}
                />
              ) : (
                <TimeView
                  cursor={cursor}
                  mode={view === 'week' ? 'week' : 'day'}
                  itemsByDayKey={itemsByDayKey}
                  theme={theme}
                  onSlotPress={onSlotPress}
                  onEventPress={setSelected}
                />
              )}
            </SwipePager>

            <Pressable
              onPress={() => openCreate(new Date())}
              style={({ pressed }) => [
                styles.fab,
                {
                  backgroundColor: theme.primary,
                  bottom: 24,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={28} color={theme.onPrimary} />
            </Pressable>
          </>
        ) : (
          <MembersView theme={theme} onEditMember={openMemberForm} />
        )}
      </View>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabs active={tab} theme={theme} onChange={setTab} />
      </View>

      <EventSheet
        item={selected}
        theme={theme}
        members={members}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onDelete={onDelete}
        onAssign={openAssign}
      />

      <EventAssignSheet
        item={assignItem}
        theme={theme}
        onClose={() => setAssignItem(null)}
      />

      <Modal
        visible={memberFormVisible}
        animationType="slide"
        onRequestClose={() => setMemberFormVisible(false)}
      >
        <MemberForm
          member={editingMember}
          theme={theme}
          onClose={() => setMemberFormVisible(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
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
