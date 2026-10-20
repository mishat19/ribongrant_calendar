import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { AppTheme } from '../theme';
import type { Member } from '../domain/types';
import { dayShort, patternLabel, periodLabel } from '../domain/availability';
import { useTeamStore } from '../store/teamStore';
import { useEventsStore } from '../store/eventsStore';
import { exportDatabase, pickAndImportDatabase } from '../lib/backup';

interface MembersViewProps {
  theme: AppTheme;
  onEditMember: (member: Member | null) => void;
}

export function MembersView({ theme, onEditMember }: MembersViewProps) {
  const db = useSQLiteContext();
  const members = useTeamStore((s) => s.members);
  const missions = useTeamStore((s) => s.missions);
  const loaded = useTeamStore((s) => s.loaded);
  const load = useTeamStore((s) => s.load);
  const removeMember = useTeamStore((s) => s.removeMember);
  const createMission = useTeamStore((s) => s.createMission);
  const removeMission = useTeamStore((s) => s.removeMission);
  const replaceEvents = useEventsStore((s) => s.replaceEvents);

  const [showMissions, setShowMissions] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newMissionName, setNewMissionName] = useState('');
  const [newMissionEmoji, setNewMissionEmoji] = useState('');

  useEffect(() => {
    if (!loaded) load(db).catch(() => undefined);
  }, [db, loaded, load]);

  const missionById = Object.fromEntries(missions.map((m) => [m.id, m]));

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await exportDatabase(db);
      if (!result.shared) {
        Alert.alert(
          'Partage indisponible',
          `La sauvegarde a été créée (${result.fileName}) mais le partage n’est pas disponible sur cet appareil.`
        );
      }
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Export impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onImport = () => {
    Alert.alert(
      'Importer une base de données ?',
      'Toutes les données actuelles (événements, membres, missions, assignations) seront remplacées par celles du fichier choisi.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Choisir un fichier',
          onPress: async () => {
            setBusy(true);
            try {
              const result = await pickAndImportDatabase(db);
              if (!result) return;
              await Promise.all([load(db), refreshEvents()]);
              Alert.alert(
                'Import réussi',
                `${result.fileName}\n${result.counts.events} événements · ${result.counts.members} membres · ${result.counts.missions} missions.`
              );
            } catch (err) {
              Alert.alert('Erreur', err instanceof Error ? err.message : 'Import impossible.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const refreshEvents = async () => {
    const { listEventsInRange } = await import('../db/database');
    const events = await listEventsInRange(db, new Date(0), new Date(8640000000000));
    replaceEvents(events);
  };

  const confirmDelete = (member: Member) => {
    Alert.alert('Supprimer ce membre ?', `${member.name} sera retiré de toutes ses missions.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeMember(db, member.id) },
    ]);
  };

  const confirmDeleteMission = (id: number, name: string) => {
    Alert.alert('Supprimer cette mission ?', `« ${name} » sera retirée de tous les membres.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeMission(db, id) },
    ]);
  };

  const addMission = async () => {
    if (!newMissionName.trim()) return;
    await createMission(db, newMissionName, newMissionEmoji || null);
    setNewMissionName('');
    setNewMissionEmoji('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={[styles.heading, { color: theme.text }]}>Membres</Text>
        <View style={styles.toolbarActions}>
          <Pressable
            onPress={() => setShowMenu(true)}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="menu" size={16} color={theme.textSecondary} />
            <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Menu</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textFaint }]}>Aucun membre pour l’instant.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIdentity}>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <View style={styles.flex}>
                  <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                  {item.role ? (
                    <Text style={[styles.role, { color: theme.textSecondary }]}>{item.role}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={() => onEditMember(item)} hitSlop={8} style={styles.iconButton}>
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={styles.iconButton}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
                </Pressable>
              </View>
            </View>

            <View style={styles.badges}>
              {item.missionIds.map((id) => {
                const mission = missionById[id];
                if (!mission) return null;
                return (
                  <View
                    key={id}
                    style={[styles.badge, { backgroundColor: theme.surfaceVariant }]}
                  >
                    <Text style={[styles.badgeText, { color: theme.text }]}>
                      {mission.emoji ? `${mission.emoji} ` : ''}
                      {mission.name}
                    </Text>
                  </View>
                );
              })}
              {item.missionIds.length === 0 ? (
                <Text style={[styles.faint, { color: theme.textFaint }]}>Aucune mission</Text>
              ) : null}
            </View>

            {item.email || item.phone ? (
              <View style={styles.contact}>
                {item.email ? (
                  <Text style={[styles.faint, { color: theme.textSecondary }]}>✉️ {item.email}</Text>
                ) : null}
                {item.phone ? (
                  <Text style={[styles.faint, { color: theme.textSecondary }]}>📞 {item.phone}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.availBlock, { borderTopColor: theme.border }]}>
              <Text style={[styles.availTitle, { color: theme.textSecondary }]}>
                Disponibilités ({item.availabilities.length})
              </Text>
              {item.availabilities.length === 0 ? (
                <Text style={[styles.faint, { color: theme.textFaint }]}>Aucune disponibilité</Text>
              ) : (
                item.availabilities.map((a) => (
                  <Text key={a.id} style={[styles.availRow, { color: theme.textSecondary }]}>
                    {dayShort(a.day)} · {periodLabel(a.period)} · {patternLabel(a.pattern)}
                  </Text>
                ))
              )}
            </View>
          </View>
        )}
      />

      <Modal visible={showMissions} transparent animationType="fade" onRequestClose={() => setShowMissions(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={() => setShowMissions(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Missions</Text>
          <FlatList
            data={missions}
            keyExtractor={(item) => String(item.id)}
            style={styles.missionList}
            ListEmptyComponent={
              <Text style={[styles.faint, { color: theme.textFaint }]}>Aucune mission.</Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.missionRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.missionName, { color: theme.text }]}>
                  {item.emoji ? `${item.emoji} ` : ''}
                  {item.name}
                </Text>
                <Pressable onPress={() => confirmDeleteMission(item.id, item.name)} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color={theme.danger} />
                </Pressable>
              </View>
            )}
          />
          <View style={styles.newMissionRow}>
            <TextInput
              value={newMissionEmoji}
              onChangeText={setNewMissionEmoji}
              placeholder="🎯"
              placeholderTextColor={theme.textFaint}
              maxLength={2}
              style={[styles.emojiInput, { color: theme.text, borderColor: theme.border }]}
            />
            <TextInput
              value={newMissionName}
              onChangeText={setNewMissionName}
              placeholder="Nouvelle mission"
              placeholderTextColor={theme.textFaint}
              style={[styles.missionInput, { color: theme.text, borderColor: theme.border }]}
            />
            <Pressable
              onPress={addMission}
              style={({ pressed }) => [styles.smallPrimary, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: theme.onPrimary, fontWeight: '600' }}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showData} transparent animationType="fade" onRequestClose={() => setShowData(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={() => setShowData(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Base de données</Text>
          <Text style={[styles.sheetHint, { color: theme.textSecondary }]}>
            Sauvegarde l’ensemble des données (événements, membres, missions, disponibilités,
            assignations) dans un fichier .db, puis partage-le où tu veux (Discord, Drive, mail…).
          </Text>
          <Pressable
            onPress={onExport}
            disabled={busy}
            style={({ pressed }) => [
              styles.dataButton,
              { backgroundColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={18} color={theme.onPrimary} />
            <Text style={[styles.dataButtonText, { color: theme.onPrimary }]}>Exporter et partager</Text>
          </Pressable>
          <Pressable
            onPress={onImport}
            disabled={busy}
            style={({ pressed }) => [
              styles.dataButtonOutline,
              { borderColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="folder-open-outline" size={18} color={theme.primary} />
            <Text style={[styles.dataButtonText, { color: theme.primary }]}>Importer un fichier</Text>
          </Pressable>
          <Text style={[styles.sheetHint, { color: theme.textFaint }]}>
            L’import remplace toutes les données actuelles.
          </Text>
        </View>
      </Modal>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={() => setShowMenu(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Actions</Text>
          <Pressable
            onPress={() => {
              setShowMenu(false);
              setShowMissions(true);
            }}
            style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="target" size={18} color={theme.text} />
            <Text style={[styles.menuItemText, { color: theme.text }]}>Missions</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowMenu(false);
              setShowData(true);
            }}
            style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="database-outline" size={18} color={theme.text} />
            <Text style={[styles.menuItemText, { color: theme.text }]}>Données (Importer/Exporter)</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowMenu(false);
              onEditMember(null);
            }}
            style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="plus" size={18} color={theme.text} />
            <Text style={[styles.menuItemText, { color: theme.text }]}>Nouveau membre</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heading: { fontSize: 20, fontWeight: '600' },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryText: { fontSize: 13, fontWeight: '500' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 32 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  flex: { flex: 1 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 16, fontWeight: '600' },
  role: { fontSize: 12, marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  contact: { marginTop: 8, gap: 2 },
  faint: { fontSize: 12 },
  availBlock: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  availTitle: { fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  availRow: { fontSize: 12, marginBottom: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '18%',
    maxHeight: '64%',
    borderRadius: 16,
    padding: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  missionList: { marginBottom: 8 },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  missionName: { fontSize: 15 },
  newMissionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  emojiInput: {
    width: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 14,
  },
  missionInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  smallPrimary: { borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  sheetHint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  dataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 22,
    paddingVertical: 12,
    marginBottom: 10,
  },
  dataButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dataButtonText: { fontSize: 14, fontWeight: '700' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuItemText: { fontSize: 15, fontWeight: '500' },
});
