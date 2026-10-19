import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppTheme } from '../theme';
import type { EventItem } from './EventBlock';
import { formatEventTime } from '../domain/dates';
import { REMINDER_OPTIONS } from '../lib/notifications';

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Aucune récurrence',
  daily: 'Tous les jours',
  weekly: 'Toutes les semaines',
  monthly: 'Tous les mois',
};

interface EventSheetProps {
  item: EventItem | null;
  theme: AppTheme;
  onClose: () => void;
  onEdit: (item: EventItem) => void;
  onDelete: (item: EventItem) => void;
}

export function EventSheet({ item, theme, onClose, onEdit, onDelete }: EventSheetProps) {
  const event = item?.event;
  const reminderLabel = event
    ? REMINDER_OPTIONS.find((o) => o.value === event.reminderMinutes)?.label ?? 'Aucun'
    : '';

  return (
    <Modal visible={item != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      {event && item ? (
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.colorBar, { backgroundColor: event.color }]} />
          <View style={styles.body}>
            <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>
            <Text style={[styles.when, { color: theme.textSecondary }]}>
              {formatEventTime(item.occurrence.start, item.occurrence.end, event.allDay)}
            </Text>
            {event.recurrence !== 'none' ? (
              <Row icon="repeat" theme={theme}>
                {RECURRENCE_LABELS[event.recurrence]}
                {event.recurrenceUntil
                  ? ` jusqu’au ${format(new Date(event.recurrenceUntil), 'd MMMM yyyy', { locale: fr })}`
                  : ''}
              </Row>
            ) : null}
            {event.reminderMinutes != null ? (
              <Row icon="bell-outline" theme={theme}>
                Rappel : {reminderLabel.toLowerCase()}
              </Row>
            ) : null}
            {event.description ? (
              <Text style={[styles.description, { color: theme.text }]}>{event.description}</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={() => onEdit(item)}
                style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.surfaceVariant, opacity: pressed ? 0.7 : 1 }]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.primary }]}>Modifier</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(item)}
                style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.surfaceVariant, opacity: pressed ? 0.7 : 1 }]}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
                <Text style={[styles.actionText, { color: theme.danger }]}>Supprimer</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.surfaceVariant, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.actionText, { color: theme.textSecondary }]}>Fermer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function Row({ icon, theme, children }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; theme: AppTheme; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.textSecondary} />
      <Text style={[styles.rowText, { color: theme.textSecondary }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  colorBar: { height: 6 },
  body: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 6 },
  when: { fontSize: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rowText: { fontSize: 13 },
  description: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  actionText: { fontSize: 13, fontWeight: '600' },
});
