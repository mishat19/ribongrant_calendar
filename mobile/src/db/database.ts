import type { SQLiteDatabase } from 'expo-sqlite';
import type { CalEvent, EventDraft, Recurrence } from '../domain/types';

const DATABASE_VERSION = 1;

interface EventRow {
  id: number;
  title: string;
  description: string | null;
  start: string;
  end: string | null;
  all_day: number;
  color: string;
  recurrence: string;
  recurrence_until: string | null;
  reminder_minutes: number | null;
  notification_ids: string | null;
}

function serialize(row: EventRow): CalEvent {
  let notificationIds: string[] = [];
  if (row.notification_ids) {
    try {
      notificationIds = JSON.parse(row.notification_ids) as string[];
    } catch {
      notificationIds = [];
    }
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start: row.start,
    end: row.end,
    allDay: row.all_day === 1,
    color: row.color,
    recurrence: (row.recurrence as Recurrence) ?? 'none',
    recurrenceUntil: row.recurrence_until,
    reminderMinutes: row.reminder_minutes,
    notificationIds,
  };
}

export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = result?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  await db.execAsync(`
    PRAGMA journal_mode = 'wal';
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start TEXT NOT NULL,
      end TEXT,
      all_day INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL,
      recurrence TEXT NOT NULL DEFAULT 'none',
      recurrence_until TEXT,
      reminder_minutes INTEGER,
      notification_ids TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);
    CREATE INDEX IF NOT EXISTS idx_events_recurrence ON events(recurrence);
  `);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export async function listEventsInRange(
  db: SQLiteDatabase,
  from: Date,
  to: Date
): Promise<CalEvent[]> {
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM events
     WHERE (start < ? AND (end IS NULL OR end > ?))
        OR (recurrence != 'none' AND start <= ? AND (recurrence_until IS NULL OR recurrence_until >= ?))
     ORDER BY start`,
    toISO,
    fromISO,
    toISO,
    from.toISOString()
  );
  return rows.map(serialize);
}

export async function getEvent(db: SQLiteDatabase, id: number): Promise<CalEvent | null> {
  const row = await db.getFirstAsync<EventRow>('SELECT * FROM events WHERE id = ?', id);
  return row ? serialize(row) : null;
}

export async function searchEvents(db: SQLiteDatabase, query: string): Promise<CalEvent[]> {
  const like = `%${query.trim()}%`;
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM events
     WHERE title LIKE ? OR IFNULL(description, '') LIKE ?
     ORDER BY start DESC
     LIMIT 100`,
    like,
    like
  );
  return rows.map(serialize);
}

export async function insertEvent(
  db: SQLiteDatabase,
  draft: EventDraft,
  notificationIds: string[]
): Promise<CalEvent> {
  const result = await db.runAsync(
    `INSERT INTO events (title, description, start, end, all_day, color, recurrence, recurrence_until, reminder_minutes, notification_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    draft.title.trim(),
    draft.description?.trim() || null,
    draft.start.toISOString(),
    draft.end.toISOString(),
    draft.allDay ? 1 : 0,
    draft.color,
    draft.recurrence,
    draft.recurrenceUntil ? draft.recurrenceUntil.toISOString() : null,
    draft.reminderMinutes,
    JSON.stringify(notificationIds)
  );
  const created = await getEvent(db, result.lastInsertRowId as number);
  if (!created) throw new Error('Événement introuvable après création');
  return created;
}

export async function updateEvent(
  db: SQLiteDatabase,
  id: number,
  draft: EventDraft,
  notificationIds: string[]
): Promise<CalEvent> {
  await db.runAsync(
    `UPDATE events SET title = ?, description = ?, start = ?, end = ?, all_day = ?, color = ?,
     recurrence = ?, recurrence_until = ?, reminder_minutes = ?, notification_ids = ?
     WHERE id = ?`,
    draft.title.trim(),
    draft.description?.trim() || null,
    draft.start.toISOString(),
    draft.end.toISOString(),
    draft.allDay ? 1 : 0,
    draft.color,
    draft.recurrence,
    draft.recurrenceUntil ? draft.recurrenceUntil.toISOString() : null,
    draft.reminderMinutes,
    JSON.stringify(notificationIds),
    id
  );
  const updated = await getEvent(db, id);
  if (!updated) throw new Error('Événement introuvable après mise à jour');
  return updated;
}

export async function deleteEvent(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM events WHERE id = ?', id);
}
