import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Assignment,
  Availability,
  CalEvent,
  DayId,
  EventDraft,
  Member,
  MemberDraft,
  Mission,
  PatternId,
  PeriodId,
  Recurrence,
} from '../domain/types';

const DATABASE_VERSION = 2;

const SEED_MEMBER_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d946ef',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
  '#8b5cf6',
  '#14b8a6',
];

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

interface MemberRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  color: string;
}

interface MissionRow {
  id: number;
  name: string;
  emoji: string | null;
}

interface AvailabilityRow {
  id: number;
  member_id: number;
  day: string;
  period: string;
  pattern: string;
}

interface MissionSlotRow {
  id: number;
  mission_id: number;
  day: string;
  start_time: string;
  end_time: string;
}

function serializeEvent(row: EventRow): CalEvent {
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

export function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      color TEXT NOT NULL DEFAULT '#2563eb',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      emoji TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS member_missions (
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      PRIMARY KEY (member_id, mission_id)
    );

    CREATE TABLE IF NOT EXISTS availabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      period TEXT NOT NULL,
      pattern TEXT NOT NULL DEFAULT 'every'
    );

    CREATE TABLE IF NOT EXISTS attributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      occurrence TEXT,
      UNIQUE (event_id, member_id, occurrence)
    );

    CREATE TABLE IF NOT EXISTS mission_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attributions_event ON attributions(event_id);
    CREATE INDEX IF NOT EXISTS idx_attributions_member ON attributions(member_id);
    CREATE INDEX IF NOT EXISTS idx_avail_member ON availabilities(member_id);
    CREATE INDEX IF NOT EXISTS idx_member_missions_member ON member_missions(member_id);
    CREATE INDEX IF NOT EXISTS idx_mission_slots_mission ON mission_slots(mission_id);
  `);

  await seedTeam(db);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

async function seedTeam(db: SQLiteDatabase): Promise<void> {
  const memberCount = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM members');
  if ((memberCount?.n ?? 0) > 0) return;

  const members: [string, string, string][] = [
    ['Camille D.', 'camille@example.org', 'Référente repas'],
    ['Yanis B.', 'yanis@example.org', 'Accueil'],
    ['Sofia M.', 'sofia@example.org', 'Ateliers'],
    ['Marc L.', 'marc@example.org', 'Logistique'],
    ['Inès K.', 'ines@example.org', 'Permanence'],
    ['Paul R.', 'paul@example.org', 'Service repas'],
  ];
  const missions: [string, string][] = [
    ['Service repas', '🍲'],
    ['Permanence accueil', '🛎️'],
    ['Atelier', '🎨'],
    ['Logistique', '📦'],
  ];
  const seedMissions: Record<number, number[]> = {
    1: [1, 2],
    2: [1],
    3: [2, 3],
    4: [1, 4],
    5: [2, 3],
    6: [1],
  };
  const seedAvail: Record<number, [DayId, PeriodId, PatternId][]> = {
    1: [
      ['mon', 'lunch', 'every'],
      ['wed', 'lunch', 'even'],
      ['fri', 'lunch', 'odd'],
    ],
    2: [
      ['tue', 'lunch', 'every'],
      ['thu', 'lunch', 'every'],
    ],
    3: [
      ['mon', 'morning', 'even'],
      ['wed', 'afternoon', 'even'],
      ['fri', 'lunch', 'even'],
    ],
    4: [
      ['wed', 'lunch', 'odd'],
      ['fri', 'lunch', 'even'],
      ['sat', 'morning', 'every'],
    ],
    5: [
      ['tue', 'afternoon', 'every'],
      ['thu', 'evening', 'odd'],
    ],
    6: [
      ['mon', 'lunch', 'odd'],
      ['tue', 'lunch', 'even'],
      ['wed', 'lunch', 'even'],
      ['thu', 'lunch', 'odd'],
      ['fri', 'lunch', 'odd'],
    ],
  };

  await db.withTransactionAsync(async () => {
    const memberIds: number[] = [];
    for (let i = 0; i < members.length; i += 1) {
      const [name, email, role] = members[i];
      const color = SEED_MEMBER_COLORS[i % SEED_MEMBER_COLORS.length];
      const res = await db.runAsync(
        'INSERT INTO members (name, email, role, color) VALUES (?, ?, ?, ?)',
        name,
        email,
        role,
        color
      );
      memberIds.push(res.lastInsertRowId as number);
    }

    const missionIds: number[] = [];
    for (const [name, emoji] of missions) {
      const res = await db.runAsync('INSERT INTO missions (name, emoji) VALUES (?, ?)', name, emoji);
      missionIds.push(res.lastInsertRowId as number);
    }

    for (const [memberIdx, missionIdxList] of Object.entries(seedMissions)) {
      for (const missionIdx of missionIdxList) {
        await db.runAsync(
          'INSERT OR IGNORE INTO member_missions (member_id, mission_id) VALUES (?, ?)',
          memberIds[Number(memberIdx) - 1],
          missionIds[missionIdx - 1]
        );
      }
    }

    for (const [memberIdx, slots] of Object.entries(seedAvail)) {
      for (const [day, period, pattern] of slots) {
        await db.runAsync(
          'INSERT INTO availabilities (member_id, day, period, pattern) VALUES (?, ?, ?, ?)',
          memberIds[Number(memberIdx) - 1],
          day,
          period,
          pattern
        );
      }
    }

    const slotRows: [number, DayId, string, string][] = [];
    const weekDays: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const allDays: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (const day of allDays) {
      slotRows.push([missionIds[0], day, '12:00', '14:00']);
      slotRows.push([missionIds[0], day, '18:00', '20:00']);
    }
    for (const day of weekDays) slotRows.push([missionIds[1], day, '09:00', '12:00']);
    slotRows.push([missionIds[2], 'tue', '14:00', '17:00']);
    slotRows.push([missionIds[2], 'thu', '14:00', '17:00']);
    slotRows.push([missionIds[3], 'wed', '09:00', '11:00']);
    for (const [missionId, day, startTime, endTime] of slotRows) {
      await db.runAsync(
        'INSERT INTO mission_slots (mission_id, day, start_time, end_time) VALUES (?, ?, ?, ?)',
        missionId,
        day,
        startTime,
        endTime
      );
    }
  });
}

/* ------------------------------------------------------------------- events */

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
  return rows.map(serializeEvent);
}

export async function getEvent(db: SQLiteDatabase, id: number): Promise<CalEvent | null> {
  const row = await db.getFirstAsync<EventRow>('SELECT * FROM events WHERE id = ?', id);
  return row ? serializeEvent(row) : null;
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
  return rows.map(serializeEvent);
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

/* ------------------------------------------------------------------ members */

export async function listMembers(db: SQLiteDatabase): Promise<Member[]> {
  const rows = await db.getAllAsync<MemberRow>(
    'SELECT * FROM members ORDER BY name COLLATE NOCASE'
  );
  return Promise.all(rows.map((row) => hydrateMember(db, row)));
}

async function hydrateMember(db: SQLiteDatabase, row: MemberRow): Promise<Member> {
  const [missionRows, availRows] = await Promise.all([
    db.getAllAsync<{ mission_id: number }>(
      'SELECT mission_id FROM member_missions WHERE member_id = ?',
      row.id
    ),
    db.getAllAsync<AvailabilityRow>(
      'SELECT id, member_id, day, period, pattern FROM availabilities WHERE member_id = ? ORDER BY id',
      row.id
    ),
  ]);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    color: row.color,
    missionIds: missionRows.map((r) => r.mission_id),
    availabilities: availRows.map(serializeAvailability),
  };
}

function serializeAvailability(row: AvailabilityRow): Availability {
  return {
    id: row.id,
    day: row.day as DayId,
    period: row.period as PeriodId,
    pattern: row.pattern as PatternId,
  };
}

async function syncMemberRelations(db: SQLiteDatabase, id: number, draft: MemberDraft): Promise<void> {
  await db.runAsync('DELETE FROM member_missions WHERE member_id = ?', id);
  for (const missionId of draft.missionIds) {
    await db.runAsync(
      'INSERT OR IGNORE INTO member_missions (member_id, mission_id) VALUES (?, ?)',
      id,
      missionId
    );
  }
  await db.runAsync('DELETE FROM availabilities WHERE member_id = ?', id);
  for (const a of draft.availabilities) {
    await db.runAsync(
      'INSERT INTO availabilities (member_id, day, period, pattern) VALUES (?, ?, ?, ?)',
      id,
      a.day,
      a.period,
      a.pattern
    );
  }
}

export async function insertMember(db: SQLiteDatabase, draft: MemberDraft): Promise<Member> {
  let createdId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO members (name, email, phone, role, color) VALUES (?, ?, ?, ?, ?)',
      draft.name.trim(),
      draft.email?.trim() || null,
      draft.phone?.trim() || null,
      draft.role?.trim() || null,
      draft.color
    );
    createdId = result.lastInsertRowId as number;
    await syncMemberRelations(db, createdId, draft);
  });
  const member = await getMember(db, createdId);
  if (!member) throw new Error('Membre introuvable après création');
  return member;
}

export async function updateMember(
  db: SQLiteDatabase,
  id: number,
  draft: MemberDraft
): Promise<Member> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE members SET name = ?, email = ?, phone = ?, role = ?, color = ? WHERE id = ?',
      draft.name.trim(),
      draft.email?.trim() || null,
      draft.phone?.trim() || null,
      draft.role?.trim() || null,
      draft.color,
      id
    );
    await syncMemberRelations(db, id, draft);
  });
  const member = await getMember(db, id);
  if (!member) throw new Error('Membre introuvable après mise à jour');
  return member;
}

export async function getMember(db: SQLiteDatabase, id: number): Promise<Member | null> {
  const row = await db.getFirstAsync<MemberRow>('SELECT * FROM members WHERE id = ?', id);
  return row ? hydrateMember(db, row) : null;
}

export async function deleteMember(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM members WHERE id = ?', id);
}

/* ----------------------------------------------------------------- missions */

export async function listMissions(db: SQLiteDatabase): Promise<Mission[]> {
  const rows = await db.getAllAsync<MissionRow>(
    'SELECT * FROM missions ORDER BY name COLLATE NOCASE'
  );
  return Promise.all(
    rows.map(async (row) => {
      const [slots, memberRows] = await Promise.all([
        db.getAllAsync<MissionSlotRow>(
          'SELECT id, mission_id, day, start_time, end_time FROM mission_slots WHERE mission_id = ? ORDER BY day, start_time',
          row.id
        ),
        db.getAllAsync<{ member_id: number }>(
          'SELECT member_id FROM member_missions WHERE mission_id = ?',
          row.id
        ),
      ]);
      return {
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        slots: slots.map((s) => ({
          id: s.id,
          missionId: s.mission_id,
          day: s.day as DayId,
          startTime: s.start_time,
          endTime: s.end_time,
        })),
        memberIds: memberRows.map((m) => m.member_id),
      };
    })
  );
}

export async function insertMission(
  db: SQLiteDatabase,
  name: string,
  emoji: string | null
): Promise<Mission> {
  const result = await db.runAsync(
    'INSERT INTO missions (name, emoji) VALUES (?, ?)',
    name.trim(),
    emoji?.trim() || null
  );
  return { id: result.lastInsertRowId as number, name: name.trim(), emoji: emoji?.trim() || null };
}

export async function updateMission(
  db: SQLiteDatabase,
  id: number,
  name: string,
  emoji: string | null
): Promise<void> {
  await db.runAsync('UPDATE missions SET name = ?, emoji = ? WHERE id = ?', name.trim(), emoji?.trim() || null, id);
}

export async function deleteMission(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM missions WHERE id = ?', id);
}

/* -------------------------------------------------------------- assignments */

export async function listAssignments(db: SQLiteDatabase): Promise<Assignment[]> {
  const rows = await db.getAllAsync<{
    id: number;
    event_id: number;
    member_id: number;
    occurrence: string | null;
  }>('SELECT * FROM attributions');
  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    memberId: row.member_id,
    occurrence: row.occurrence,
  }));
}

export async function listAssignmentsForEvent(
  db: SQLiteDatabase,
  eventId: number
): Promise<Assignment[]> {
  const rows = await db.getAllAsync<{
    id: number;
    event_id: number;
    member_id: number;
    occurrence: string | null;
  }>('SELECT * FROM attributions WHERE event_id = ?', eventId);
  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    memberId: row.member_id,
    occurrence: row.occurrence,
  }));
}

export async function setOccurrenceAssignments(
  db: SQLiteDatabase,
  eventId: number,
  occurrence: string,
  memberIds: number[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM attributions WHERE event_id = ? AND occurrence = ?',
      eventId,
      occurrence
    );
    for (const memberId of memberIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO attributions (event_id, member_id, occurrence) VALUES (?, ?, ?)',
        eventId,
        memberId,
        occurrence
      );
    }
  });
}
