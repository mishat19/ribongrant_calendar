import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { searchEvents } from '../db/database';
import type { CalEvent } from '../domain/types';
import { useTheme } from '../theme';

export default function SearchScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CalEvent[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchEvents(db, trimmed);
      if (!cancelled) setResults(found);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [db, query]);

  const trimmed = query.trim();
  const grouped = trimmed.length < 1 ? [] : results;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.icon}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textSecondary} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un événement"
          placeholderTextColor={theme.textFaint}
          autoFocus
          style={[styles.input, { color: theme.text }]}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.icon}>
            <MaterialCommunityIcons name="close-circle" size={20} color={theme.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="magnify" size={40} color={theme.textFaint} />
            <Text style={[styles.emptyText, { color: theme.textFaint }]}>
              {trimmed.length === 0 ? 'Recherche par titre ou description' : 'Aucun résultat'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const start = new Date(item.start);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/event', params: { id: String(item.id) } })}
              style={({ pressed }) => [
                styles.result,
                { borderBottomColor: theme.border, backgroundColor: pressed ? theme.surfaceVariant : 'transparent' },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.resultBody}>
                <Text numberOfLines={1} style={[styles.resultTitle, { color: theme.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.resultDate, { color: theme.textSecondary }]}>
                  {format(start, 'EEEE d MMMM yyyy · HH:mm', { locale: fr })}
                  {item.allDay ? ' · toute la journée' : ''}
                </Text>
                {item.description ? (
                  <Text numberOfLines={1} style={[styles.resultDescription, { color: theme.textFaint }]}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              {isPast(start) ? (
                <Text style={[styles.past, { color: theme.textFaint }]}>Passé</Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  icon: { padding: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 4 },
  empty: { alignItems: 'center', marginTop: 64, gap: 12 },
  emptyText: { fontSize: 14 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  resultBody: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '600' },
  resultDate: { fontSize: 12, marginTop: 2 },
  resultDescription: { fontSize: 12, marginTop: 2 },
  past: { fontSize: 11 },
});
