import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { AppTheme } from '../theme';
import type { AvailabilityDraft, Member, PatternId, PeriodId, DayId } from '../domain/types';
import { DAYS, PATTERNS, PERIODS } from '../domain/availability';
import { useTeamStore } from '../store/teamStore';

const COLORS = [
  '#2563eb',
  '#16a34a',
  '#d946ef',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
  '#8b5cf6',
  '#14b8a6',
];

interface MemberFormProps {
  member: Member | null;
  theme: AppTheme;
  onClose: () => void;
}

export function MemberForm({ member, theme, onClose }: MemberFormProps) {
  const db = useSQLiteContext();
  const missions = useTeamStore((s) => s.missions);
  const createMember = useTeamStore((s) => s.createMember);
  const editMember = useTeamStore((s) => s.editMember);
  const createMission = useTeamStore((s) => s.createMission);
  const removeMember = useTeamStore((s) => s.removeMember);

  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState(member?.role ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [color, setColor] = useState(member?.color ?? COLORS[0]);
  const [missionIds, setMissionIds] = useState<number[]>(member?.missionIds ?? []);
  const [availabilities, setAvailabilities] = useState<AvailabilityDraft[]>(
    member?.availabilities.map((a) => ({ day: a.day, period: a.period, pattern: a.pattern })) ?? []
  );
  const [newMissionName, setNewMissionName] = useState('');
  const [saving, setSaving] = useState(false);

  const availableMissions = useMemo(
    () => missions.filter((m) => !missionIds.includes(m.id)),
    [missions, missionIds]
  );

  const toggleMission = (id: number) => {
    setMissionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addAvailability = () => {
    setAvailabilities((prev) => [...prev, { day: 'mon', period: 'lunch', pattern: 'every' }]);
  };

  const patchAvailability = (index: number, patch: Partial<AvailabilityDraft>) => {
    setAvailabilities((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const removeAvailability = (index: number) => {
    setAvailabilities((prev) => prev.filter((_, i) => i !== index));
  };

  const addMissionInline = async () => {
    if (!newMissionName.trim()) return;
    const created = await createMission(db, newMissionName, null);
    setMissionIds((prev) => [...prev, created.id]);
    setNewMissionName('');
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Indique un nom pour le membre.');
      return;
    }
    setSaving(true);
    try {
      const draft = {
        name: name.trim(),
        role: role.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        color,
        missionIds,
        availabilities,
      };
      if (member) await editMember(db, member.id, draft);
      else await createMember(db, draft);
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible d’enregistrer le membre.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!member) return;
    Alert.alert('Supprimer ce membre ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await removeMember(db, member.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={onClose} hitSlop={8} style={styles.headerSide}>
          <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {member ? 'Modifier le membre' : 'Nouveau membre'}
        </Text>
        <View style={styles.headerSide}>
          {member ? (
            <Pressable onPress={onDelete} hitSlop={8}>
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.danger} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Nom *" theme={theme}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nom du membre"
            placeholderTextColor={theme.textFaint}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            autoFocus={!member}
          />
        </Field>
        <Field label="Rôle" theme={theme}>
          <TextInput
            value={role}
            onChangeText={setRole}
            placeholder="Rôle"
            placeholderTextColor={theme.textFaint}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
        </Field>
        <Field label="Email" theme={theme}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.org"
            placeholderTextColor={theme.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
        </Field>
        <Field label="Téléphone" theme={theme}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Téléphone"
            placeholderTextColor={theme.textFaint}
            keyboardType="phone-pad"
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
        </Field>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Couleur</Text>
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.colorDot,
                { backgroundColor: c, borderColor: color === c ? theme.text : 'transparent' },
              ]}
            >
              {color === c ? <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" /> : null}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Missions</Text>
        <View style={styles.chips}>
          {missions.map((m) => {
            const active = missionIds.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleMission(m.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? (theme.dark ? '#394457' : '#D2E3FC') : theme.surfaceVariant,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? theme.primary : theme.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? '600' : '400',
                  }}
                >
                  {m.emoji ? `${m.emoji} ` : ''}
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
          {availableMissions.length === 0 && missions.length > 0 ? (
            <Text style={[styles.faint, { color: theme.textFaint }]}>Toutes assignées</Text>
          ) : null}
        </View>
        <View style={styles.inlineRow}>
          <TextInput
            value={newMissionName}
            onChangeText={setNewMissionName}
            placeholder="Créer une mission…"
            placeholderTextColor={theme.textFaint}
            style={[styles.inlineInput, { color: theme.text, borderColor: theme.border }]}
          />
          <Pressable
            onPress={addMissionInline}
            style={({ pressed }) => [
              styles.inlineButton,
              { backgroundColor: theme.surfaceVariant, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={18} color={theme.primary} />
          </Pressable>
        </View>

        <View style={styles.availHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Disponibilités</Text>
          <Pressable
            onPress={addAvailability}
            style={({ pressed }) => [
              styles.addButton,
              { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={16} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Ajouter</Text>
          </Pressable>
        </View>

        {availabilities.length === 0 ? (
          <Text style={[styles.faint, { color: theme.textFaint }]}>Aucune disponibilité renseignée.</Text>
        ) : null}

        {availabilities.map((a, index) => (
          <View key={index} style={[styles.availCard, { borderColor: theme.border }]}>
            <OptionRow
              label="Jour"
              options={DAYS.map((d) => ({ id: d.id, label: d.short }))}
              value={a.day}
              theme={theme}
              onSelect={(id) => patchAvailability(index, { day: id as DayId })}
            />
            <OptionRow
              label="Période"
              options={PERIODS.map((p) => ({ id: p.id, label: p.label }))}
              value={a.period}
              theme={theme}
              onSelect={(id) => patchAvailability(index, { period: id as PeriodId })}
            />
            <OptionRow
              label="Rythme"
              options={PATTERNS.map((p) => ({ id: p.id, label: p.short }))}
              value={a.pattern}
              theme={theme}
              onSelect={(id) => patchAvailability(index, { pattern: id as PatternId })}
            />
            <Pressable onPress={() => removeAvailability(index)} hitSlop={8} style={styles.removeAvail}>
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.danger} />
              <Text style={{ color: theme.danger, fontSize: 12 }}>Retirer</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.primary, opacity: saving ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.saveText, { color: theme.onPrimary }]}>
            {member ? 'Enregistrer' : 'Créer'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  theme,
  children,
}: {
  label: string;
  theme: AppTheme;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function OptionRow({
  label,
  options,
  value,
  theme,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  theme: AppTheme;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={[
                styles.smallChip,
                {
                  backgroundColor: active ? (theme.dark ? '#394457' : '#D2E3FC') : theme.surfaceVariant,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.primary : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: active ? '600' : '400',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { width: 40, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8, marginBottom: 8 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  faint: { fontSize: 12 },
  inlineRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  inlineInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  inlineButton: { borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  availHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  availCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 10, gap: 10 },
  optionRow: { gap: 6 },
  optionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  smallChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  removeAvail: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  saveButton: { marginTop: 24, borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700' },
});
