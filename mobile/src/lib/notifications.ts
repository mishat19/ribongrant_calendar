import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { expandEvent } from '../domain/recurrence';
import type { CalEvent } from '../domain/types';

const REMINDERS_WINDOW_DAYS = 45;
const MAX_SCHEDULED = 60;
const CHANNEL_ID = 'reminders';

export const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Aucun', value: null },
  { label: 'Au moment de l’événement', value: 0 },
  { label: '5 minutes avant', value: 5 },
  { label: '10 minutes avant', value: 10 },
  { label: '30 minutes avant', value: 30 },
  { label: '1 heure avant', value: 60 },
  { label: '1 jour avant', value: 60 * 24 },
];

let channelReady = false;

export async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappels d’événements',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A73E8',
    });
  }
  channelReady = true;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

export async function cancelReminders(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
    )
  );
}

interface ReminderSource {
  id?: number;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  recurrence: CalEvent['recurrence'];
  recurrenceUntil: Date | null;
  reminderMinutes: number | null;
}

export async function scheduleReminders(source: ReminderSource): Promise<string[]> {
  const reminderMinutes = source.reminderMinutes;
  if (reminderMinutes == null) return [];
  if (!channelReady) await ensureNotificationSetup().catch(() => false);

  const calEvent: CalEvent = {
    id: source.id ?? 0,
    title: source.title,
    description: source.description,
    start: source.start.toISOString(),
    end: source.end.toISOString(),
    allDay: source.allDay,
    color: source.color,
    recurrence: source.recurrence,
    recurrenceUntil: source.recurrenceUntil ? source.recurrenceUntil.toISOString() : null,
    reminderMinutes: source.reminderMinutes,
    notificationIds: [],
  };

  const now = new Date();
  const until = new Date(now.getTime() + REMINDERS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const occurrences = expandEvent(calEvent, now, until).slice(0, MAX_SCHEDULED);
  const ids: string[] = [];

  for (const occurrence of occurrences) {
    const fireAt = new Date(occurrence.start.getTime() - reminderMinutes * 60 * 1000);
    if (fireAt.getTime() <= now.getTime() + 5000) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: calEvent.title,
          body:
            reminderMinutes >= 60 * 24
              ? 'Rappel programmé'
              : reminderMinutes > 0
                ? `Dans ${reminderMinutes} minutes`
                : 'C’est le moment',
          sound: true,
          data: { eventId: calEvent.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: CHANNEL_ID,
        },
      });
      ids.push(id);
    } catch {
      // Ignore scheduling failures (permissions revoked, past date, …)
    }
  }

  return ids;
}
