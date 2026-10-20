import { useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppTheme } from '../theme';
import { DAY_LETTERS, weekDays } from '../domain/dates';
import { clipToDay, type EventItem, type PositionedEvent } from './EventBlock';
import { GUTTER, HOUR_HEIGHT, TimeGrid } from './TimeGrid';

interface TimeViewProps {
  cursor: Date;
  mode: 'week' | 'day';
  itemsByDayKey: Record<string, EventItem[]>;
  theme: AppTheme;
  onSlotPress: (day: Date, minutes: number) => void;
  onEventPress: (item: EventItem) => void;
}

export function TimeView({ cursor, mode, itemsByDayKey, theme, onSlotPress, onEventPress }: TimeViewProps) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const days = useMemo(
    () => (mode === 'week' ? weekDays(cursor) : [new Date(cursor)]),
    [cursor, mode]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 7.5 * HOUR_HEIGHT, animated: false });
  }, [mode]);

  const itemsByDay = useMemo(
    () =>
      days.map((day) => {
        const dayKey = day.toDateString();
        const all = itemsByDayKey[dayKey] ?? [];
        return all.filter((item) => !item.event.allDay && clipToDay(item.occurrence, day));
      }),
    [days, itemsByDayKey]
  );

  const allDayByDay = useMemo(
    () =>
      days.map((day) =>
        (itemsByDayKey[day.toDateString()] ?? []).filter((item) => item.event.allDay)
      ),
    [days, itemsByDayKey]
  );

  const allDayRows = Math.max(1, Math.max(...allDayByDay.map((list) => list.length)));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.headerRow, { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={[styles.gutterCell, { width: GUTTER }]} />
        {days.map((day) => {
          const mark = isToday(day);
          return (
            <View key={day.toISOString()} style={[styles.dayHeaderCell, { flex: 1, borderLeftColor: theme.border, borderLeftWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.dayLetter, { color: mark ? theme.primary : theme.textSecondary }]}>
                {mode === 'week' ? DAY_LETTERS[(day.getDay() + 6) % 7] : format(day, 'EEEE', { locale: fr })}
              </Text>
              <View style={[styles.dayCircle, mark ? { backgroundColor: theme.primary } : null]}>
                <Text
                  style={[
                    styles.dayNumber,
                    { color: mark ? theme.onPrimary : theme.text },
                    mode === 'day' ? styles.dayNumberLarge : null,
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.allDayStrip, { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, height: allDayRows * 26 + 8 }]}>
        <View style={{ width: GUTTER }} />
        {days.map((day, dayIndex) => (
          <View
            key={`ad-${day.toISOString()}`}
            style={[styles.allDayColumn, { borderLeftColor: theme.border, borderLeftWidth: StyleSheet.hairlineWidth }]}
          >
            {allDayByDay[dayIndex].map((item) => (
              <Pressable
                key={`${item.event.id}-${item.occurrence.start.toISOString()}`}
                onPress={() => onEventPress(item)}
                style={[styles.allDayChip, { backgroundColor: item.event.color }]}
              >
                <Text numberOfLines={1} style={styles.allDayText}>
                  {item.event.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ height: 24 * HOUR_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        <TimeGrid
          days={days}
          itemsByDay={itemsByDay}
          width={width}
          theme={theme}
          onSlotPress={onSlotPress}
          onEventPress={(item: PositionedEvent) =>
            onEventPress({ event: item.event, occurrence: item.occurrence })
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 6 },
  gutterCell: {},
  dayHeaderCell: { alignItems: 'center', paddingBottom: 4 },
  dayLetter: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  dayCircle: {
    marginTop: 3,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayNumber: { fontSize: 14, fontWeight: '500' },
  dayNumberLarge: { fontSize: 18, fontWeight: '600' },
  allDayStrip: { flexDirection: 'row' },
  allDayColumn: { flex: 1, padding: 2, gap: 2 },
  allDayChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 4 },
  allDayText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  scroll: { flex: 1 },
});
