import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import type { AppTheme } from '../theme';
import { EventBlock, layoutDayItems, type EventItem, type PositionedEvent } from './EventBlock';

export const HOUR_HEIGHT = 52;
const GUTTER = 48;

interface TimeGridProps {
  days: Date[];
  itemsByDay: EventItem[][];
  width: number;
  theme: AppTheme;
  onSlotPress: (day: Date, minutes: number) => void;
  onEventPress: (item: PositionedEvent) => void;
}

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function TimeGrid({ days, itemsByDay, width, theme, onSlotPress, onEventPress }: TimeGridProps) {
  const [nowMinutes, setNowMinutes] = useState(minutesNow);
  const columnWidth = (width - GUTTER) / days.length;
  const gridHeight = 24 * HOUR_HEIGHT;
  const todayKey = new Date().toDateString();
  const todayIndex = days.findIndex((d) => d.toDateString() === todayKey);

  useEffect(() => {
    const timer = setInterval(() => setNowMinutes(minutesNow()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const positioned: PositionedEvent[][] = days.map((day, i) =>
    layoutDayItems(itemsByDay[i] ?? [], day, HOUR_HEIGHT)
  );

  return (
    <View style={[styles.grid, { height: gridHeight, width }]}>
      {Array.from({ length: 25 }, (_, hour) => (
        <View
          key={`line-${hour}`}
          style={[styles.hourLine, hour % 2 === 0 ? null : styles.halfHourLine, { top: hour * HOUR_HEIGHT, width: width - GUTTER, left: GUTTER, borderColor: theme.hourLine }]}
        />
      ))}
      {Array.from({ length: 24 }, (_, hour) =>
        days.map((day, dayIndex) => (
          <Pressable
            key={`slot-${day.toISOString()}-${hour}`}
            onPress={() => onSlotPress(day, hour * 60)}
            style={{
              position: 'absolute',
              top: hour * HOUR_HEIGHT,
              left: GUTTER + dayIndex * columnWidth,
              width: columnWidth,
              height: HOUR_HEIGHT,
            }}
          />
        ))
      )}
      {days.map((day, dayIndex) => (
        <View key={`events-${day.toISOString()}`} pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, width, height: gridHeight }}>
          {positioned[dayIndex].map((item) => (
            <EventBlock
              key={`${item.event.id}-${item.occurrence.start.toISOString()}-${item.column}`}
              item={item}
              width={GUTTER + columnWidth * (dayIndex + 1)}
              gutter={GUTTER + dayIndex * columnWidth}
              theme={theme}
              onPress={onEventPress}
            />
          ))}
        </View>
      ))}
      {Array.from({ length: 24 }, (_, hour) => (
        <Text
          key={`label-${hour}`}
          style={[styles.hourLabel, { top: hour * HOUR_HEIGHT - 7, color: theme.textFaint }]}
        >
          {hour === 0 ? '' : format(new Date(2024, 0, 1, hour), 'HH:mm')}
        </Text>
      ))}
      {todayIndex >= 0 ? (
        <View
          pointerEvents="none"
          style={[styles.nowLine, { top: (nowMinutes / 60) * HOUR_HEIGHT, left: GUTTER + todayIndex * columnWidth, width: columnWidth }]}
        >
          <View style={[styles.nowDot, { backgroundColor: theme.nowLine }]} />
          <View style={[styles.nowBar, { backgroundColor: theme.nowLine }]} />
        </View>
      ) : null}
    </View>
  );
}

export { GUTTER };

const styles = StyleSheet.create({
  grid: {
    position: 'relative',
  },
  hourLine: {
    position: 'absolute',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  halfHourLine: {
    opacity: 0.35,
  },
  hourLabel: {
    position: 'absolute',
    left: 4,
    width: 40,
    fontSize: 11,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  nowLine: {
    position: 'absolute',
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -1,
  },
  nowBar: {
    flex: 1,
    height: 2,
  },
});
