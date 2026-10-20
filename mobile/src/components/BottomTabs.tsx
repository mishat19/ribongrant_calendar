import { StyleSheet, Text, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AppTheme } from '../theme';

export type TabId = 'calendar' | 'team';

const TABS: { key: TabId; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'calendar', label: 'Calendrier', icon: 'calendar-month-outline' },
  { key: 'team', label: 'Membres', icon: 'account-group-outline' },
];

interface BottomTabsProps {
  active: TabId;
  theme: AppTheme;
  onChange: (tab: TabId) => void;
}

export function BottomTabs({ active, theme, onChange }: BottomTabsProps) {
  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {TABS.map((tab) => {
        const focused = tab.key === active;
        const color = focused ? theme.primary : theme.textSecondary;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}
          >
            <MaterialCommunityIcons name={tab.icon} size={24} color={color} />
            <Text style={[styles.label, { color, fontWeight: focused ? '600' : '400' }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  label: { fontSize: 11 },
});
