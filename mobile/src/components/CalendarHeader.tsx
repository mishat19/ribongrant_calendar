import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { AppTheme } from "../theme";
import type { CalendarView } from "../domain/types";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "month", label: "Mois" },
  { key: "week", label: "Semaine" },
  { key: "day", label: "Jour" },
];

interface CalendarHeaderProps {
  title: string;
  view: CalendarView;
  theme: AppTheme;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onSearch: () => void;
  onExportPdf?: () => void;
}

export function CalendarHeader({
  title,
  view,
  theme,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onSearch,
  onExportPdf,
}: CalendarHeaderProps) {
  const today = new Date();
  const dayNumber = String(today.getDate()).padStart(2, "0");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, borderBottomColor: theme.border },
      ]}
    >
      <View style={styles.topRow}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
        <View style={styles.topActions}>
          <Pressable
            onPress={onToday}
            hitSlop={8}
            accessibilityLabel="Aujourd'hui"
            style={({ pressed }) => [
              styles.todayButton,
              { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.todayText, { color: theme.primary }]}>
              {today.getDate()}
            </Text>
          </Pressable>
          {onExportPdf ? (
            <Pressable
              onPress={onExportPdf}
              hitSlop={8}
              accessibilityLabel="Partager le planning de la semaine en PDF"
              style={({ pressed }) => [
                styles.iconButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={24}
                color={theme.textSecondary}
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onSearch}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={24}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>
      </View>
      <View style={styles.controlsRow}>
        <View style={styles.arrows}>
          <Pressable
            onPress={onPrev}
            hitSlop={8}
            style={({ pressed }) => [
              styles.arrow,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={theme.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={onNext}
            hitSlop={8}
            style={({ pressed }) => [
              styles.arrow,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={26}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>
        <View
          style={[styles.segment, { backgroundColor: theme.surfaceVariant }]}
        >
          {VIEWS.map((item) => {
            const active = item.key === view;
            return (
              <Pressable
                key={item.key}
                onPress={() => onViewChange(item.key)}
                style={[
                  styles.segmentItem,
                  active
                    ? { backgroundColor: theme.dark ? "#394457" : "#D2E3FC" }
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? theme.primary : theme.textSecondary },
                    active ? { fontWeight: "600" } : null,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: "500" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  todayButton: {
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  todayText: { fontSize: 15, fontWeight: "600" },
  iconButton: { padding: 4 },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arrows: { flexDirection: "row" },
  arrow: { padding: 2 },
  segment: { flexDirection: "row", borderRadius: 18, padding: 2 },
  segmentItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  segmentText: { fontSize: 13 },
});
