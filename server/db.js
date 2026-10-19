import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.APP_DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "data.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  role       TEXT,
  color      TEXT NOT NULL DEFAULT '#2563eb',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS missions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  emoji      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_missions (
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, mission_id)
);

CREATE TABLE IF NOT EXISTS availabilities (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  day       TEXT NOT NULL,
  period    TEXT NOT NULL,
  pattern   TEXT NOT NULL DEFAULT 'every'
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  start       TEXT NOT NULL,
  end         TEXT,
  all_day     INTEGER NOT NULL DEFAULT 0,
  color       TEXT,
  recurrence  TEXT NOT NULL DEFAULT 'none',
  recurrence_until TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attributions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  occurrence TEXT,
  UNIQUE (event_id, member_id, occurrence)
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);
CREATE INDEX IF NOT EXISTS idx_attributions_event ON attributions(event_id);
CREATE INDEX IF NOT EXISTS idx_attributions_member ON attributions(member_id);
CREATE INDEX IF NOT EXISTS idx_avail_member ON availabilities(member_id);
CREATE INDEX IF NOT EXISTS idx_member_missions_member ON member_missions(member_id);

CREATE TABLE IF NOT EXISTS mission_slots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mission_slots_mission ON mission_slots(mission_id);
`);

function hasColumn(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}
if (!hasColumn("events", "recurrence")) {
  db.exec("ALTER TABLE events ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'");
}
if (!hasColumn("events", "recurrence_until")) {
  db.exec("ALTER TABLE events ADD COLUMN recurrence_until TEXT");
}

if (!hasColumn("attributions", "occurrence")) {
  db.exec(`
    ALTER TABLE attributions RENAME TO attributions_old;
    CREATE TABLE attributions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      occurrence TEXT,
      UNIQUE (event_id, member_id, occurrence)
    );
    INSERT INTO attributions (event_id, member_id, occurrence)
      SELECT a.event_id, a.member_id, substr(e.start, 1, 10)
        FROM attributions_old a JOIN events e ON e.id = a.event_id;
    DROP TABLE attributions_old;
    CREATE INDEX IF NOT EXISTS idx_attributions_event ON attributions(event_id);
    CREATE INDEX IF NOT EXISTS idx_attributions_member ON attributions(member_id);
  `);
}

const hasMembers = db.prepare("SELECT COUNT(*) AS n FROM members").get().n > 0;

if (!hasMembers) {
  const insertMember = db.prepare(
    "INSERT INTO members (name, email, role, color) VALUES (?, ?, ?, ?)",
  );
  const seed = [
    ["Camille D.", "camille@example.org", "Référente repas", "#2563eb"],
    ["Yanis B.", "yanis@example.org", "Accueil", "#16a34a"],
    ["Sofia M.", "sofia@example.org", "Ateliers", "#d946ef"],
    ["Marc L.", "marc@example.org", "Logistique", "#f59e0b"],
    ["Inès K.", "ines@example.org", "Permanence", "#ef4444"],
    ["Paul R.", "paul@example.org", "Service repas", "#0ea5e9"],
  ];
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insertMember.run(...row);
  });
  insertAll(seed);

  const insertEvent = db.prepare(
    `INSERT INTO events (title, description, start, end, all_day, color, recurrence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAttr = db.prepare(
    "INSERT INTO attributions (event_id, member_id, occurrence) VALUES (?, ?, ?)",
  );
  const pad2 = (n) => String(n).padStart(2, "0");
  const occurrence = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const iso = (offsetDays, h, m) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const seedEvents = db.transaction(() => {
    const info = insertEvent.run(
      "Service repas",
      "Service du midi",
      iso(2, 10, 30),
      iso(2, 13, 30),
      0,
      "#2563eb",
      "none",
    );
    insertAttr.run(info.lastInsertRowid, 1, occurrence(2));
    insertAttr.run(info.lastInsertRowid, 4, occurrence(2));
    const info2 = insertEvent.run(
      "Atelier créatif",
      "Atelier ouvert à tous",
      iso(4, 14, 0),
      iso(4, 16, 30),
      0,
      "#d946ef",
      "weekly",
    );
    insertAttr.run(info2.lastInsertRowid, 3, occurrence(4));
  });
  seedEvents();
}

const hasMissions = db.prepare("SELECT COUNT(*) AS n FROM missions").get().n > 0;

if (!hasMissions) {
  const insertMission = db.prepare("INSERT INTO missions (name, emoji) VALUES (?, ?)");
  const insertMemberMission = db.prepare(
    "INSERT OR IGNORE INTO member_missions (member_id, mission_id) VALUES (?, ?)",
  );
  const insertAvailability = db.prepare(
    "INSERT INTO availabilities (member_id, day, period, pattern) VALUES (?, ?, ?, ?)",
  );
  const missions = [
    ["Service repas", "🍲"],
    ["Permanence accueil", "🛎️"],
    ["Atelier", "🎨"],
    ["Logistique", "📦"],
  ];
  const seedMissions = db.transaction(() => {
    for (const [name, emoji] of missions) insertMission.run(name, emoji);
  });
  seedMissions();

  const SEED_MISSIONS = {
    1: [1, 2],
    2: [1],
    3: [2, 3],
    4: [1, 4],
    5: [2, 3],
    6: [1],
  };
  const SEED_AVAIL = {
    1: [
      ["mon", "lunch", "every"],
      ["wed", "lunch", "even"],
      ["fri", "lunch", "odd"],
    ],
    2: [
      ["tue", "lunch", "every"],
      ["thu", "lunch", "every"],
    ],
    3: [
      ["mon", "morning", "even"],
      ["wed", "afternoon", "even"],
      ["fri", "lunch", "even"],
    ],
    4: [
      ["wed", "lunch", "odd"],
      ["fri", "lunch", "even"],
      ["sat", "morning", "every"],
    ],
    5: [
      ["tue", "afternoon", "every"],
      ["thu", "evening", "odd"],
    ],
    6: [
      ["mon", "lunch", "odd"],
      ["tue", "lunch", "even"],
      ["wed", "lunch", "even"],
      ["thu", "lunch", "odd"],
      ["fri", "lunch", "odd"],
    ],
  };
  const seedRelations = db.transaction(() => {
    for (const [memberId, missionIds] of Object.entries(SEED_MISSIONS)) {
      for (const missionId of missionIds) insertMemberMission.run(memberId, missionId);
    }
    for (const [memberId, slots] of Object.entries(SEED_AVAIL)) {
      for (const [day, period, pattern] of slots) {
        insertAvailability.run(memberId, day, period, pattern);
      }
    }
  });
  seedRelations();
}

db.prepare("INSERT OR IGNORE INTO missions (name, emoji) VALUES (?, ?)").run(
  "Service à table",
  "🍽️",
);

const hasSlots = db.prepare("SELECT COUNT(*) AS n FROM mission_slots").get().n > 0;

if (!hasSlots) {
  const idOf = (name) => db.prepare("SELECT id FROM missions WHERE name=?").get(name).id;
  const insertSlot = db.prepare(
    "INSERT INTO mission_slots (mission_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
  );
  const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri"];
  const rows = [];
  const service = idOf("Service à table");
  for (const d of ALL_DAYS) {
    rows.push([service, d, "12:00", "14:00"]);
    rows.push([service, d, "18:00", "20:00"]);
  }
  const permanence = idOf("Permanence accueil");
  for (const d of WEEK_DAYS) rows.push([permanence, d, "09:00", "12:00"]);
  const atelier = idOf("Atelier");
  rows.push([atelier, "tue", "14:00", "17:00"]);
  rows.push([atelier, "thu", "14:00", "17:00"]);
  const logistique = idOf("Logistique");
  rows.push([logistique, "wed", "09:00", "11:00"]);
  const seedSlots = db.transaction(() => {
    for (const r of rows) insertSlot.run(...r);
  });
  seedSlots();
}

export default db;
