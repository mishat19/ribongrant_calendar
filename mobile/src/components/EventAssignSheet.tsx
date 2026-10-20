import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppTheme } from '../theme';
import type { EventItem } from './EventBlock';
import { dateKey } from '../db/database';
import { eligibleMembers } from '../domain/availability';
import { useTeamStore } from '../store/teamStore';

interface EventAssignSheetProps {
  item: EventItem | null;
  theme: AppTheme;
  onClose: () => void;
}

export function EventAssignSheet({ item, theme, onClose }: EventAssignSheetProps) {
  const db = useSQLiteContext();
  const members = useTeamStore((s) => s.members);
  const missions = useTeamStore((s) => s.missions);
  const assignments = useTeamStore((s) => s.assignments);
  const assignOccurrence = useTeamStore((s) => s.assignOccurrence);
  const [busy, setBusy] = useState(false);

  const occurrence = useMemo(
    () => item?.occurrence.start ?? new Date(),
    [item]
  );
  const key = dateKey(occurrence);

  const assignedIds = useMemo(
    () =>
      assignments
        .filter((a) => item != null && a.eventId === item.event.id && a.occurrence === key)
        .map((a) => a.memberId),
    [assignments, item, key]
  );

  const available = useMemo(
    () => eligibleMembers(members, occurrence, item?.event.allDay ?? false),
    [members, occurrence, item?.event.allDay]
  );
  const availableIds = useMemo(() => new Set(available.map((m) => m.id)), [available]);

  const listed = useMemo(() => {
    const assignedSet = new Set(assignedIds);
    return members.filter((m) => availableIds.has(m.id) || assignedSet.has(m.id));
  }, [members, availableIds, assignedIds]);

  const toggle = async (memberId: number) => {
    if (!item || busy) return;
    setBusy(true);
    const next = assignedIds.includes(memberId)
      ? assignedIds.filter((id) => id !== memberId)
      : [...assignedIds, memberId];
    try {
      await assignOccurrence(db, item.event.id, key, next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={item != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      {item ? (
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.colorBar, { backgroundColor: item.event.color }]} />
          <View style={styles.body}>
            <Text style={[styles.title, { color: theme.text }]}>{item.event.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {format(occurrence, 'EEEE d MMMM yyyy · HH:mm', { locale: fr })}
            </Text>
            {item.event.recurrence !== 'none' ? (
              <Text style={[styles.subtitle, { color: theme.textFaint }]}>
                Assignation valable uniquement pour cette occurrence
              </Text>
            ) : null}

            <View style={styles.counterRow}>
              <MaterialCommunityIcons name="account-check-outline" size={16} color={theme.primary} />
              <Text style={[styles.counter, { color: theme.primary }]}>
                {available.length}/{members.length} disponible(s) à cette date
              </Text>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {listed.map((member) => {
                const assigned = assignedIds.includes(member.id);
                const isAvailable = availableIds.has(member.id);
                const memberMissions = member.missionIds
                  .map((id) => missions.find((m) => m.id === id))
                  .filter(Boolean);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => toggle(member.id)}
                    style={({ pressed }) => [
                      styles.memberRow,
                      {
                        borderColor: assigned ? member.color : theme.border,
                        backgroundColor: assigned ? `${member.color}18` : 'transparent',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={assigned ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={22}
                      color={assigned ? member.color : theme.textFaint}
                    />
                    <View style={styles.memberBody}>
                      <View style={styles.memberNameRow}>
                        <View style={[styles.dot, { backgroundColor: member.color }]} />
                        <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                        {!isAvailable ? (
                          <View style={[styles.availBadge, { backgroundColor: theme.surfaceVariant }]}>
                            <Text style={[styles.availBadgeText, { color: theme.textFaint }]}>non dispo</Text>
                          </View>
                        ) : null}
                      </View>
                      {memberMissions.length > 0 ? (
                        <Text numberOfLines={1} style={[styles.memberMissions, { color: theme.textFaint }]}>
                          {memberMissions
                            .map((m) => `${m!.emoji ? `${m!.emoji} ` : ''}${m!.name}`)
                            .join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {listed.length === 0 ? (
                <Text style={[styles.empty, { color: theme.textFaint }]}>
                  {members.length === 0
                    ? 'Aucun membre. Crée-en dans l’onglet Membres.'
                    : 'Aucun membre disponible à cette date.'}
                </Text>
              ) : null}
            </ScrollView>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.closeText, { color: theme.onPrimary }]}>Terminé</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '12%',
    maxHeight: '76%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  colorBar: { height: 6 },
  body: { padding: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 6 },
  counter: { fontSize: 13, fontWeight: '600' },
  list: { maxHeight: 380 },
  listContent: { paddingVertical: 4, gap: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  memberBody: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  memberName: { fontSize: 15, fontWeight: '500' },
  availBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  availBadgeText: { fontSize: 10, fontWeight: '600' },
  memberMissions: { fontSize: 11, marginTop: 2 },
  empty: { fontSize: 13, textAlign: 'center', marginTop: 12 },
  closeButton: { marginTop: 14, borderRadius: 22, paddingVertical: 12, alignItems: 'center' },
  closeText: { fontSize: 15, fontWeight: '700' },
});
