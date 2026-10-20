import { Pressable, StyleSheet, Text } from 'react-native';
import type { AppTheme } from '../theme';
import type { CalEvent, Occurrence } from '../domain/types';

export interface EventItem {
  event: CalEvent;
  occurrence: Occurrence;
  availableCount?: number;
  totalMembers?: number;
  assignedNames?: string[];
}

export interface PositionedEvent extends EventItem {
  column: number;
  columns: number;
  top: number;
  height: number;
  clippedStart: Date;
  clippedEnd: Date;
  availableCount?: number;
  totalMembers?: number;
  assignedNames?: string[];
}

const MINUTES_IN_DAY = 24 * 60;

export function clipToDay(occurrence: Occurrence, day: Date): { start: Date; end: Date } | null {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  const start = occurrence.start > dayStart ? occurrence.start : dayStart;
  const end = occurrence.end < dayEnd ? occurrence.end : dayEnd;
  if (start >= end) return null;
  return { start, end };
}

function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function layoutDayItems(items: EventItem[], day: Date, hourHeight: number): PositionedEvent[] {
  const clipped: (EventItem & { start: Date; end: Date })[] = [];
  for (const item of items) {
    const bounds = clipToDay(item.occurrence, day);
    if (bounds) clipped.push({ ...item, start: bounds.start, end: bounds.end });
  }
  clipped.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

  const result: PositionedEvent[] = [];
  let cluster: typeof clipped = [];
  let clusterEnd = 0;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columns: Date[] = [];
    const assigned = cluster.map((item) => {
      let col = columns.findIndex((colEnd) => colEnd <= item.start);
      if (col === -1) {
        col = columns.length;
        columns.push(item.end);
      } else {
        columns[col] = item.end;
      }
      return { item, col };
    });
    const total = columns.length;
    for (const { item, col } of assigned) {
      const top = (minutesOf(item.start) / 60) * hourHeight;
      const rawHeight = ((minutesOf(item.end) - minutesOf(item.start)) / 60) * hourHeight;
      result.push({
        event: item.event,
        occurrence: item.occurrence,
        availableCount: item.availableCount,
        totalMembers: item.totalMembers,
        assignedNames: item.assignedNames,
        column: col,
        columns: total,
        top,
        height: Math.max(rawHeight, 20),
        clippedStart: item.start,
        clippedEnd: item.end,
      });
    }
    cluster = [];
  };

  for (const item of clipped) {
    if (cluster.length > 0 && item.start.getTime() >= clusterEnd) {
      flushCluster();
      clusterEnd = 0;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
  }
  flushCluster();

  return result;
}

interface EventBlockProps {
  item: PositionedEvent;
  width: number;
  gutter: number;
  theme: AppTheme;
  onPress: (item: PositionedEvent) => void;
}

export function EventBlock({ item, width, gutter, theme, onPress }: EventBlockProps) {
  const columnWidth = (width - gutter) / item.columns;
  const left = gutter + item.column * columnWidth + 1;
  const blockWidth = Math.max(columnWidth - 3, 20);
  const tint = theme.dark ? item.event.color : item.event.color;
  const background = theme.dark ? `${item.event.color}33` : `${item.event.color}1F`;

  const summary =
    item.height > 60 && item.availableCount != null && item.totalMembers != null
      ? `${item.availableCount}/${item.totalMembers} dispo`
      : null;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.block,
        {
          left,
          top: item.top,
          width: blockWidth,
          height: item.height,
          backgroundColor: background,
          borderLeftColor: tint,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.title, { color: theme.text, fontSize: item.height > 40 ? 13 : 11 }]}>
        {item.event.title}
      </Text>
      {item.height > 40 && item.assignedNames && item.assignedNames.length > 0
        ? item.assignedNames.map((name) => (
            <Text key={name} numberOfLines={1} style={[styles.summary, { color: theme.textSecondary }]}>
              {name}
            </Text>
          ))
        : null}
      {summary ? (
        <Text numberOfLines={1} style={[styles.summary, { color: theme.textSecondary }]}>
          {summary}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const MINUTES_PER_DAY = MINUTES_IN_DAY;

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderRadius: 6,
    borderLeftWidth: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  title: {
    fontWeight: '600',
  },
  summary: {
    fontSize: 10,
    marginTop: 1,
  },
});
