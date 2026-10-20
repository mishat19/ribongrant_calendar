import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isToday } from 'date-fns';
import type { AppTheme } from '../theme';
import { DAY_LETTERS, monthGrid } from '../domain/dates';
import type { EventItem } from './EventBlock';

interface MonthViewProps {
  cursor: Date;
  itemsByDayKey: Record<string, EventItem[]>;
  theme: AppTheme;
  onDayPress: (day: Date) => void;
  onEventPress: (item: EventItem) => void;
  onMorePress?: (day: Date, items: EventItem[]) => void;
}

const MAX_CHIPS = 3;

export const MonthView = memo(function MonthView({
  cursor,
  itemsByDayKey,
  theme,
  onDayPress,
  onEventPress,
}: MonthViewProps) {
  const days = monthGrid(cursor);

  return (
    <View style={styles.container}>
      <View style={styles.weekHeader}>
        {DAY_LETTERS.map((letter, i) => (
          <View key={`h-${i}`} style={styles.weekHeaderCell}>
            <Text style={[styles.weekHeaderText, { color: i >= 5 ? theme.primary : theme.textSecondary }]}>{letter}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const key = day.toDateString();
          const items = itemsByDayKey[key] ?? [];
          const todayMark = isToday(day);
          const outside = day.getMonth() !== cursor.getMonth();
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const visible = items.slice(0, MAX_CHIPS);
          const extra = items.length - visible.length;

          return (
            <Pressable
              key={key}
              onPress={() => onDayPress(day)}
              style={[
                styles.cell,
                {
                  borderBottomColor: theme.border,
                  borderRightColor: theme.border,
                  backgroundColor: weekend && !outside && !theme.dark ? '#F8F9FA' : theme.background,
                  opacity: outside ? 0.45 : 1,
                },
              ]}
            >
              <View style={styles.dayNumberRow}>
                {todayMark ? (
                  <View style={[styles.todayCircle, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.todayNumber, { color: theme.onPrimary }]}>{day.getDate()}</Text>
                  </View>
                ) : (
                  <Text style={[styles.dayNumber, { color: theme.textSecondary }]}>{day.getDate()}</Text>
                )}
              </View>
              {visible.map((item) => {
                const startLabel = item.event.allDay ? item.event.title : `${item.event.title}`;
                return (
                  <Pressable
                    key={`${item.event.id}-${item.occurrence.start.toISOString()}`}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onEventPress(item);
                    }}
                    style={[styles.chip, { backgroundColor: item.event.color }]}
                  >
                    <Text numberOfLines={1} style={styles.chipText}>
                      {startLabel}
                    </Text>
                  </Pressable>
                );
              })}
              {extra > 0 ? (
                <Text style={[styles.more, { color: theme.textSecondary }]}>+{extra} de plus</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

export function groupByDayKey(items: EventItem[]): Record<string, EventItem[]> {
  const map: Record<string, EventItem[]> = {};
  for (const item of items) {
    const start = item.occurrence.start;
    const end = item.occurrence.end;
    const cursorDay = new Date(start);
    cursorDay.setHours(0, 0, 0, 0);
    while (cursorDay <= end) {
      const key = cursorDay.toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(item);
      const next = new Date(cursorDay);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      if (next.getTime() === cursorDay.getTime()) break;
      cursorDay.setTime(next.getTime());
    }
  }
  return map;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  weekHeader: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EAED' },
  weekHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  weekHeaderText: { fontSize: 12, fontWeight: '600' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  dayNumberRow: { alignItems: 'center', marginBottom: 2, height: 26 },
  dayNumber: { fontSize: 12, fontWeight: '500', lineHeight: 24, paddingHorizontal: 6 },
  todayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNumber: { fontSize: 12, fontWeight: '700' },
  chip: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 2,
  },
  chipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' },
  more: { fontSize: 10, paddingHorizontal: 4, marginBottom: 2 },
});
