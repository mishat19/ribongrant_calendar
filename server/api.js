import express from "express";
import db from "./db.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const DATA_DIR = process.env.APP_DATA_DIR || __dirname;
const upload = multer({ dest: path.join(DATA_DIR, "tmp_uploads") });
const DB_PATH = path.join(DATA_DIR, "data.db");
const DB_WAL_PATH = path.join(DATA_DIR, "data.db-wal");
const DB_SHM_PATH = path.join(DATA_DIR, "data.db-shm");
const TMP_UPLOADS = path.join(DATA_DIR, "tmp_uploads");

/* ------------------------------------------------------------------ members */

const memberInsert = db.prepare(
  "INSERT INTO members (name, email, phone, role, color) VALUES (?, ?, ?, ?, ?)",
);
const memberUpdate = db.prepare(
  "UPDATE members SET name=?, email=?, phone=?, role=?, color=? WHERE id=?",
);
const memberDelete = db.prepare("DELETE FROM members WHERE id=?");
const memberGet = db.prepare("SELECT * FROM members WHERE id=?");
const membersAll = db.prepare(
  "SELECT * FROM members ORDER BY name COLLATE NOCASE",
);

const memberMissionsStmt = db.prepare(
  "SELECT mission_id FROM member_missions WHERE member_id=?",
);
const memberAvailStmt = db.prepare(
  "SELECT id, day, period, pattern FROM availabilities WHERE member_id=? ORDER BY id",
);
const memberMissionDelete = db.prepare(
  "DELETE FROM member_missions WHERE member_id=?",
);
const memberMissionInsert = db.prepare(
  "INSERT OR IGNORE INTO member_missions (member_id, mission_id) VALUES (?, ?)",
);
const memberAvailDelete = db.prepare(
  "DELETE FROM availabilities WHERE member_id=?",
);
const availInsert = db.prepare(
  "INSERT INTO availabilities (member_id, day, period, pattern) VALUES (?, ?, ?, ?)",
);

function withRelations(m) {
  return {
    ...m,
    missionIds: memberMissionsStmt.all(m.id).map((r) => r.mission_id),
    availabilities: memberAvailStmt.all(m.id),
  };
}

function syncMemberRelations(id, missionIds, availabilities) {
  const tx = db.transaction(() => {
    if (Array.isArray(missionIds)) {
      memberMissionDelete.run(id);
      for (const mid of missionIds) memberMissionInsert.run(id, mid);
    }
    if (Array.isArray(availabilities)) {
      memberAvailDelete.run(id);
      for (const a of availabilities) {
        if (!a || !a.day || !a.period) continue;
        availInsert.run(id, a.day, a.period, a.pattern || "every");
      }
    }
  });
  tx();
}

app.get("/api/members", (req, res) => {
  res.json(membersAll.all().map(withRelations));
});

app.post("/api/members", (req, res) => {
  const { name, email, phone, role, color = "#2563eb", missionIds, availabilities } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const info = memberInsert.run(name, email || null, phone || null, role || null, color);
  syncMemberRelations(info.lastInsertRowid, missionIds, availabilities);
  res.status(201).json(withRelations(memberGet.get(info.lastInsertRowid)));
});

app.put("/api/members/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = memberGet.get(id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const { name, email, phone, role, color, missionIds, availabilities } = req.body;
  memberUpdate.run(
    name ?? existing.name,
    email ?? existing.email,
    phone ?? existing.phone,
    role ?? existing.role,
    color ?? existing.color,
    id,
  );
  syncMemberRelations(id, missionIds, availabilities);
  res.json(withRelations(memberGet.get(id)));
});

app.delete("/api/members/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!memberGet.get(id)) return res.status(404).json({ error: "not found" });
  memberDelete.run(id);
  res.json({ ok: true });
});

/* ----------------------------------------------------------------- missions */

app.get("/api/missions", (req, res) => {
  res.json(db.prepare("SELECT * FROM missions ORDER BY name COLLATE NOCASE").all());
});

app.post("/api/missions", (req, res) => {
  const { name, emoji } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
  const info = db
    .prepare("INSERT INTO missions (name, emoji) VALUES (?, ?)")
    .run(name.trim(), emoji || null);
  res.status(201).json(db.prepare("SELECT * FROM missions WHERE id=?").get(info.lastInsertRowid));
});

app.put("/api/missions/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM missions WHERE id=?").get(id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const { name, emoji } = req.body;
  db.prepare("UPDATE missions SET name=?, emoji=? WHERE id=?").run(
    name ?? existing.name,
    emoji ?? existing.emoji,
    id,
  );
  res.json(db.prepare("SELECT * FROM missions WHERE id=?").get(id));
});

app.delete("/api/missions/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT * FROM missions WHERE id=?").get(id)) {
    return res.status(404).json({ error: "not found" });
  }
  db.prepare("DELETE FROM missions WHERE id=?").run(id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------- events */

const eventsAll = db.prepare("SELECT * FROM events ORDER BY start ASC");
const eventGet = db.prepare("SELECT * FROM events WHERE id=?");
const eventInsert = db.prepare(
  `INSERT INTO events (title, description, start, end, all_day, color, recurrence, recurrence_until)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const eventUpdate = db.prepare(
  `UPDATE events SET title=?, description=?, start=?, end=?, all_day=?, color=?, recurrence=?, recurrence_until=?
   WHERE id=?`,
);
const eventDelete = db.prepare("DELETE FROM events WHERE id=?");
const attrByEvent = db.prepare(
  "SELECT member_id, occurrence FROM attributions WHERE event_id=?",
);
const occDelete = db.prepare(
  "DELETE FROM attributions WHERE event_id=? AND occurrence=?",
);
const occInsert = db.prepare(
  "INSERT OR IGNORE INTO attributions (event_id, member_id, occurrence) VALUES (?, ?, ?)",
);

function serializeEvent(e) {
  const attributions = attrByEvent.all(e.id);
  return {
    ...e,
    all_day: !!e.all_day,
    recurrence: e.recurrence || "none",
    attributions,
    memberIds: [...new Set(attributions.map((a) => a.member_id))],
  };
}

app.get("/api/events", (req, res) => {
  res.json(eventsAll.all().map(serializeEvent));
});

app.post("/api/events", (req, res) => {
  const {
    title,
    description,
    start,
    end,
    all_day = false,
    color,
    recurrence = "none",
    recurrence_until,
  } = req.body;
  if (!title || !start) return res.status(400).json({ error: "title and start are required" });
  if (end && end <= start)
    return res.status(400).json({ error: "end must be after start" });
  const info = eventInsert.run(
    title,
    description || null,
    start,
    end || null,
    all_day ? 1 : 0,
    color || null,
    recurrence,
    recurrence_until || null,
  );
  res.status(201).json(serializeEvent(eventGet.get(info.lastInsertRowid)));
});

app.put("/api/events/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = eventGet.get(id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const { title, description, start, end, all_day, color, recurrence, recurrence_until } =
    req.body;
  const nextStart = start ?? existing.start;
  const nextEnd = end ?? existing.end;
  if (nextEnd && nextEnd <= nextStart)
    return res.status(400).json({ error: "end must be after start" });
  eventUpdate.run(
    title ?? existing.title,
    description ?? existing.description,
    nextStart,
    nextEnd,
    typeof all_day === "boolean" ? (all_day ? 1 : 0) : existing.all_day,
    color ?? existing.color,
    recurrence ?? existing.recurrence,
    recurrence_until !== undefined ? recurrence_until : existing.recurrence_until,
    id,
  );
  res.json(serializeEvent(eventGet.get(id)));
});

app.put("/api/events/:id/occurrence", (req, res) => {
  const id = Number(req.params.id);
  if (!eventGet.get(id)) return res.status(404).json({ error: "not found" });
  const { occurrence, memberIds = [] } = req.body;
  if (!occurrence) return res.status(400).json({ error: "occurrence is required" });
  const tx = db.transaction(() => {
    occDelete.run(id, occurrence);
    for (const mid of memberIds) occInsert.run(id, mid, occurrence);
  });
  tx();
  res.json({ ok: true });
});

app.delete("/api/events/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!eventGet.get(id)) return res.status(404).json({ error: "not found" });
  eventDelete.run(id);
  res.json({ ok: true });
});

app.get("/api/attributions", (req, res) => {
  res.json(db.prepare("SELECT * FROM attributions").all());
});

/* ------------------------------------------------------------- fixed slots */

const DAY_JS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MISSION_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d946ef",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
];
const pad2 = (n) => String(n).padStart(2, "0");

function parseLocal(value) {
  return typeof value === "string" && value.length <= 10
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
}

function nextOccurrence(day, h, m) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  d.setDate(d.getDate() + ((DAY_JS[day] - d.getDay() + 7) % 7));
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

app.get("/api/mission-slots", (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT s.*, m.name AS mission_name, m.emoji AS mission_emoji
           FROM mission_slots s JOIN missions m ON m.id = s.mission_id
          ORDER BY m.name, s.day, s.start_time`,
      )
      .all(),
  );
});

app.post("/api/mission-slots/place", (req, res) => {
  const slots = db
    .prepare(
      `SELECT s.*, m.name AS mission_name
         FROM mission_slots s JOIN missions m ON m.id = s.mission_id`,
    )
    .all();
  const existing = db
    .prepare("SELECT title, start, recurrence FROM events")
    .all();
  const until = new Date();
  until.setMonth(until.getMonth() + 3);
  const untilStr = `${until.getFullYear()}-${pad2(until.getMonth() + 1)}-${pad2(until.getDate())}`;

  let created = 0;
  const tx = db.transaction(() => {
    for (const s of slots) {
      const [h, mn] = s.start_time.split(":").map(Number);
      const [eh, emn] = s.end_time.split(":").map(Number);
      const start = nextOccurrence(s.day, h, mn);
      const duplicate = existing.some((e) => {
        if (e.title !== s.mission_name || e.recurrence !== "weekly") return false;
        const sd = parseLocal(e.start);
        return sd.getDay() === DAY_JS[s.day] && sd.getHours() === h && sd.getMinutes() === mn;
      });
      if (duplicate) continue;
      const end = new Date(start);
      end.setHours(eh, emn, 0, 0);
      const color = MISSION_COLORS[s.mission_id % MISSION_COLORS.length];
      eventInsert.run(
        s.mission_name,
        null,
        start.toISOString(),
        end.toISOString(),
        0,
        color,
        "weekly",
        untilStr,
      );
      created += 1;
    }
  });
  tx();
  res.json({ created });
});

// Export database as a backup
app.get("/api/db/export", (req, res) => {
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", "attachment; filename=ribongrant_calendar.db");
  const readStream = fs.createReadStream(DB_PATH);
  readStream.on("error", (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to export database" });
    }
  });
  readStream.pipe(res);
});

// Import database (will overwrite existing database)
app.post("/api/db/import", upload.single("db"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Please provide a .db file" });
  }
  const uploadedFile = req.file.path;
  try {
    // Check if uploaded file is a SQLite database (16-byte header)
    const fd = fs.openSync(uploadedFile, "r");
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
    if (buffer.toString("latin1") !== "SQLite format 3\x00") {
      fs.unlinkSync(uploadedFile);
      return res.status(400).json({ error: "Invalid database file" });
    }

    // Close the current database connection
    db.close();

    // Backup existing WAL/SHM files and replace DB
    try { if (fs.existsSync(DB_WAL_PATH)) fs.unlinkSync(DB_WAL_PATH); } catch (e) { /* ignore */ }
    try { if (fs.existsSync(DB_SHM_PATH)) fs.unlinkSync(DB_SHM_PATH); } catch (e) { /* ignore */ }

    // Copy uploaded file to DB_PATH
    fs.copyFileSync(uploadedFile, DB_PATH);

    // Clean up uploaded file
    try { fs.unlinkSync(uploadedFile); } catch (e) { /* ignore */ }

    // Clean up tmp directory
    try { fs.rmSync(TMP_UPLOADS, { recursive: true, force: true }); fs.mkdirSync(TMP_UPLOADS); } catch (e) { /* ignore */ }

    res.json({ ok: true, message: "Database imported successfully. Server will need to restart to use new database." });
  } catch (err) {
    try { fs.unlinkSync(uploadedFile); } catch (e) { /* ignore */ }
    // Try to reinitialize DB connection
    try {
      db.prepare("SELECT 1").get();
    } catch (e) { /* ignore */ }
    res.status(500).json({ error: "Failed to import database: " + err.message });
  }
});

export default app;

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
