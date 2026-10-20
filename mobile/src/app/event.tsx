import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, addHours, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EVENT_COLORS, useTheme } from '../theme';
import { useEventsStore } from '../store/eventsStore';
import { REMINDER_OPTIONS } from '../lib/notifications';
import type { Recurrence } from '../domain/types';

const RECURRENCES: { key: Recurrence; label: string }[] = [
  { key: 'none', label: 'Aucune' },
  { key: 'daily', label: 'Quotidienne' },
  { key: 'weekly', label: 'Hebdomadaire' },
  { key: 'monthly', label: 'Mensuelle' },
];

type PickerTarget = 'start-date' | 'start-time' | 'end-date' | 'end-time' | 'until' | null;

export default function EventEditorScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; start?: string; end?: string; allDay?: string }>();
  const createEvent = useEventsStore((s) => s.createEvent);
  const editEvent = useEventsStore((s) => s.editEvent);
  const removeEvent = useEventsStore((s) => s.removeEvent);
  const events = useEventsStore((s) => s.events);

  const editingId = params.id ? Number(params.id) : null;
  const existing = editingId != null ? events.find((e) => e.id === editingId) ?? null : null;

  const initial = useMemo(() => {
    if (existing) {
      return {
        title: existing.title,
        description: existing.description ?? '',
        start: new Date(existing.start),
        end: existing.end ? new Date(existing.end) : addHours(new Date(existing.start), 1),
        allDay: existing.allDay,
        color: existing.color,
        recurrence: existing.recurrence,
        recurrenceUntil: existing.recurrenceUntil ? new Date(existing.recurrenceUntil) : null,
        reminderMinutes: existing.reminderMinutes,
      };
    }
    const start = params.start ? new Date(params.start) : new Date();
    const end = params.end ? new Date(params.end) : addHours(start, 1);
    const allDay = params.allDay === '1';
    return {
      title: '',
      description: '',
      start,
      end,
      allDay,
      color: EVENT_COLORS[0],
      recurrence: 'none' as Recurrence,
      recurrenceUntil: null as Date | null,
      reminderMinutes: null as number | null,
    };
  }, [existing, params.start, params.end, params.allDay]);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [color, setColor] = useState(initial.color);
  const [recurrence, setRecurrence] = useState(initial.recurrence);
  const [recurrenceUntil, setRecurrenceUntil] = useState(initial.recurrenceUntil);
  const [reminderMinutes, setReminderMinutes] = useState(initial.reminderMinutes);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [saving, setSaving] = useState(false);

  const setStartDate = (date: Date) => {
    const duration = end.getTime() - start.getTime();
    const fallback = allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const next = allDay ? startOfDay(date) : date;
    setStart(next);
    setEnd(new Date(next.getTime() + (duration > 0 ? duration : fallback)));
  };

  const setEndDate = (date: Date) => {
    if (date.getTime() <= start.getTime()) {
      Alert.alert('Horaires invalides', 'La fin doit être après le début.');
      return;
    }
    setEnd(date);
  };

  const onPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const isAndroid = Platform.OS === 'android';
    if (isAndroid) setPicker(null);
    if (event.type === 'dismissed' || !selectedDate) return;

    switch (picker) {
      case 'start-date': {
        const next = new Date(selectedDate);
        next.setHours(start.getHours(), start.getMinutes(), 0, 0);
        setStartDate(next);
        break;
      }
      case 'start-time': {
        const next = new Date(start);
        next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
        setStartDate(next);
        break;
      }
      case 'end-date': {
        const next = new Date(selectedDate);
        next.setHours(end.getHours(), end.getMinutes(), 0, 0);
        setEndDate(next);
        break;
      }
      case 'end-time': {
        const next = new Date(end);
        next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
        setEndDate(next);
        break;
      }
      case 'until':
        setRecurrenceUntil(startOfDay(selectedDate));
        break;
      default:
        break;
    }
  };

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Indique un titre pour l’événement.');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      Alert.alert('Horaires invalides', 'La fin doit être après le début.');
      return;
    }
    setSaving(true);
    try {
      const draft = {
        title: title.trim(),
        description: description.trim() || null,
        start,
        end,
        allDay,
        color,
        recurrence,
        recurrenceUntil: recurrence === 'none' ? null : recurrenceUntil,
        reminderMinutes,
      };
      if (editingId != null) {
        await editEvent(db, editingId, draft);
      } else {
        await createEvent(db, draft);
      }
      router.back();
    } catch {
      Alert.alert('Erreur', 'Impossible d’enregistrer l’événement.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Supprimer l’événement ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (existing) {
            await removeEvent(db, existing);
          }
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
          <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {editingId != null ? 'Modifier l’événement' : 'Nouvel événement'}
        </Text>
        <View style={styles.headerSide}>
          {editingId != null ? (
            <Pressable onPress={onDelete} hitSlop={8}>
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.danger} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ajouter un titre"
          placeholderTextColor={theme.textFaint}
          style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
          autoFocus={editingId == null}
          returnKeyType="done"
        />

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Toute la journée</Text>
          <Switch
            value={allDay}
            onValueChange={(v) => {
              setAllDay(v);
              if (v) {
                setStart(startOfDay(start));
                setEnd(addDays(startOfDay(start), 1));
              } else {
                const rounded = new Date(start);
                rounded.setMinutes(0, 0, 0);
                setStart(rounded);
                setEnd(addHours(rounded, 1));
              }
            }}
            trackColor={{ true: theme.primary }}
          />
        </View>

        <Section icon="calendar-start" label="Début" theme={theme}>
          <Pressable onPress={() => setPicker('start-date')} style={[styles.pill, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={[styles.pillText, { color: theme.text }]}>
              {format(start, 'EEEE d MMMM yyyy', { locale: fr })}
            </Text>
          </Pressable>
          {!allDay ? (
            <Pressable onPress={() => setPicker('start-time')} style={[styles.pill, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[styles.pillText, { color: theme.text }]}>{format(start, 'HH:mm')}</Text>
            </Pressable>
          ) : null}
        </Section>

        <Section icon="calendar-end" label="Fin" theme={theme}>
          <Pressable onPress={() => setPicker('end-date')} style={[styles.pill, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={[styles.pillText, { color: theme.text }]}>
              {format(end, 'EEEE d MMMM yyyy', { locale: fr })}
            </Text>
          </Pressable>
          {!allDay ? (
            <Pressable onPress={() => setPicker('end-time')} style={[styles.pill, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[styles.pillText, { color: theme.text }]}>{format(end, 'HH:mm')}</Text>
            </Pressable>
          ) : null}
        </Section>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Répétition</Text>
        <View style={styles.chipRow}>
          {RECURRENCES.map((item) => {
            const active = recurrence === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setRecurrence(item.key)}
                style={[
                  styles.choiceChip,
                  {
                    backgroundColor: active ? (theme.dark ? '#394457' : '#D2E3FC') : theme.surfaceVariant,
                  },
                ]}
              >
                <Text style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: active ? '600' : '400', fontSize: 13 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {recurrence !== 'none' ? (
          <Section icon="calendar-end" label="Fin de récurrence" theme={theme}>
            <Pressable onPress={() => setPicker('until')} style={[styles.pill, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[styles.pillText, { color: theme.text }]}>
                {recurrenceUntil
                  ? `Jusqu’au ${format(recurrenceUntil, 'd MMMM yyyy', { locale: fr })}`
                  : 'Sans fin'}
              </Text>
            </Pressable>
            {recurrenceUntil ? (
              <Pressable onPress={() => setRecurrenceUntil(null)} hitSlop={6}>
                <Text style={{ color: theme.primary, fontSize: 13, marginTop: 6 }}>Retirer la date de fin</Text>
              </Pressable>
            ) : null}
          </Section>
        ) : null}

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Rappel</Text>
        <View style={styles.chipRow}>
          {REMINDER_OPTIONS.map((item) => {
            const active = reminderMinutes === item.value;
            return (
              <Pressable
                key={item.label}
                onPress={() => setReminderMinutes(item.value)}
                style={[
                  styles.choiceChip,
                  { backgroundColor: active ? (theme.dark ? '#394457' : '#D2E3FC') : theme.surfaceVariant },
                ]}
              >
                <Text style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: active ? '600' : '400', fontSize: 13 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Couleur</Text>
        <View style={styles.colorRow}>
          {EVENT_COLORS.map((c) => (
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

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Ajouter une description"
          placeholderTextColor={theme.textFaint}
          multiline
          style={[styles.description, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
        />

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.primary, opacity: saving ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.saveText, { color: theme.onPrimary }]}>
            {editingId != null ? 'Enregistrer' : 'Créer'}
          </Text>
        </Pressable>
      </ScrollView>

      {picker ? (
        <View style={[styles.pickerOverlay, { backgroundColor: theme.surface }]}>
          <DateTimePicker
            value={
              picker === 'end-date' || picker === 'end-time'
                ? end
                : picker === 'until'
                  ? recurrenceUntil ?? addDays(start, 7)
                  : start
            }
            mode={picker === 'start-time' || picker === 'end-time' ? 'time' : 'date'}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onPickerChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setPicker(null)} style={[styles.pickerDone, { backgroundColor: theme.primary }]}>
              <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Terminé</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Section({
  icon,
  label,
  theme,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={18} color={theme.textSecondary} />
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{label}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
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
  titleInput: {
    fontSize: 22,
    fontWeight: '500',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLabel: { fontSize: 15 },
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionBody: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 16, marginBottom: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  pillText: { fontSize: 14, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  description: {
    minHeight: 90,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700' },
  pickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    paddingBottom: 16,
  },
  pickerDone: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
