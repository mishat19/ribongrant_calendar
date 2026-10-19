import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";
import { parseDate, eligibleMembers } from "../lib/availability.js";

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#d946ef",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
];

const RECURRENCES = [
  { id: "none", label: "Aucune (événement unique)" },
  { id: "daily", label: "Tous les jours" },
  { id: "weekly", label: "Toutes les semaines" },
  { id: "monthly", label: "Tous les mois" },
];

const pad = (n) => String(n).padStart(2, "0");

function toLocalInput(value) {
  if (!value) return "";
  const d = parseDate(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(value) {
  if (!value) return "";
  const d = parseDate(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function expandEvent(ev) {
  const recurring = (ev.recurrence || "none") !== "none";
  const ext = {
    description: ev.description,
    attributions: ev.attributions || [],
    seriesId: ev.id,
    recurring,
  };
  const color = ev.color || undefined;
  const build = (start, end, id) => ({
    id,
    title: ev.title,
    start,
    end,
    allDay: ev.all_day,
    backgroundColor: color,
    borderColor: color,
    startEditable: !recurring,
    durationEditable: !recurring,
    extendedProps: { ...ext, occurrence: toDateInput(start) },
  });

  const start = parseDate(ev.start);
  if (!start) return [];

  if (!recurring) {
    return [
      build(start, ev.end ? parseDate(ev.end) : undefined, String(ev.id)),
    ];
  }

  const end = ev.end ? parseDate(ev.end) : null;
  const durationMs = end ? end - start : null;
  const until = ev.recurrence_until ? parseDate(ev.recurrence_until) : null;
  const hardStop =
    until ||
    new Date(start.getFullYear() + 2, start.getMonth(), start.getDate());

  const out = [];
  let cur = new Date(start);
  let i = 0;
  while (cur <= hardStop && i < 500) {
    const occEnd =
      durationMs != null ? new Date(cur.getTime() + durationMs) : undefined;
    out.push(build(new Date(cur), occEnd, `${ev.id}#${i}`));
    i += 1;
    if (ev.recurrence === "daily") {
      const n = new Date(cur);
      n.setDate(n.getDate() + 1);
      cur = n;
    } else if (ev.recurrence === "weekly") {
      const n = new Date(cur);
      n.setDate(n.getDate() + 7);
      cur = n;
    } else if (ev.recurrence === "monthly") {
      const n = new Date(cur);
      n.setMonth(n.getMonth() + 1);
      cur = n;
    } else break;
  }
  return out;
}

function EventSlot({ arg, ctx }) {
  const { event } = arg;
  const isTimeGrid = String(arg.view.type).startsWith("timeGrid");
  const { members, updateAssignments } = ctx;
  const total = members.length;
  const available = eligibleMembers(members, event.start, event.allDay);
  const occurrence = event.extendedProps.occurrence;
  const attributions = event.extendedProps.attributions || [];
  const assignedIds = attributions
    .filter((a) => a.occurrence === occurrence)
    .map((a) => a.member_id);
  const assigned = assignedIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);
  const options = [...available];
  for (const m of assigned) {
    if (!options.find((o) => o.id === m.id)) options.push(m);
  }
  const addable = available.filter((m) => !assignedIds.includes(m.id));
  const stop = (e) => e.stopPropagation();

  const swap = (oldId, value) => {
    const next =
      value === ""
        ? assignedIds.filter((x) => x !== oldId)
        : assignedIds.map((x) => (x === oldId ? Number(value) : x));
    updateAssignments(event, next);
  };

  return (
    <div className="px-1 py-0.5 overflow-hidden text-[10px] leading-tight">
      <div className="font-semibold truncate" title={event.title}>
        {event.title}
      </div>
      <div className="opacity-80">
        {available.length}/{total} dispo
      </div>
      {isTimeGrid && (
        <div className="mt-0.5 space-y-0.5" onMouseDown={stop} onClick={stop}>
          {assigned.map((m) => (
            <select
              key={m.id}
              value={m.id}
              onChange={(e) => swap(m.id, e.target.value)}
              className="w-full rounded border border-white/50 bg-white/95 text-slate-800 text-[10px] px-0.5 leading-tight"
            >
              <option value="">— retirer —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ))}
          <select
            value=""
            onChange={(e) =>
              e.target.value &&
              updateAssignments(event, [...assignedIds, Number(e.target.value)])
            }
            className="w-full rounded border border-white/50 bg-white/95 text-slate-800 text-[10px] px-0.5 leading-tight"
          >
            <option value="">{addable.length ? "+ assigner…" : "—"}</option>
            {addable.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState(null);
  const calRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [evs, mems] = await Promise.all([
        api("/api/events"),
        api("/api/members"),
      ]);
      setEvents(evs);
      setMembers(mems);
      setError(null);
    } catch {
      setError("API indisponible — lance `npm run dev:api`");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fcEvents = useMemo(
    () => events.flatMap((e) => expandEvent(e)),
    [events],
  );

  const updateAssignments = useCallback(
    async (event, ids) => {
      const sid = event.extendedProps?.seriesId ?? event.id;
      const occurrence = event.extendedProps?.occurrence;
      try {
        await api(`/api/events/${sid}/occurrence`, {
          method: "PUT",
          body: JSON.stringify({ occurrence, memberIds: ids }),
        });
        load();
      } catch (err) {
        setError(err.message);
      }
    },
    [load],
  );

  const ctxRef = useRef({ members: [], updateAssignments: () => {} });
  useEffect(() => {
    ctxRef.current = { members, updateAssignments };
  }, [members, updateAssignments]);
  const renderEventContent = useCallback(
    (arg) => <EventSlot arg={arg} ctx={ctxRef.current} />,
    [],
  );

  const openCreate = (info) => {
    const allDay = !!info.allDay;
    // `select` provides start/end; `dateClick` provides date/dateStr only.
    const startDate =
      info.start || info.date || parseDate(info.startStr || info.dateStr);
    if (!startDate) return;
    let start;
    let end;
    if (allDay) {
      const endDate = info.endStr
        ? parseDate(info.endStr)
        : new Date(startDate.getTime() + 86400000);
      start = toDateInput(startDate);
      end = toDateInput(endDate);
    } else {
      const endDate = info.end || new Date(startDate.getTime() + 3600000);
      start = toLocalInput(startDate);
      end = toLocalInput(endDate);
    }
    setModal({
      mode: "create",
      data: {
        title: "",
        description: "",
        start,
        end,
        all_day: allDay,
        color: COLORS[0],
        recurrence: "none",
        recurrence_until: "",
      },
    });
  };

  const openEdit = (info) => {
    const seriesId = info.event.extendedProps?.seriesId ?? info.event.id;
    const ev = events.find((e) => String(e.id) === String(seriesId));
    if (!ev) return;
    setModal({
      mode: "edit",
      data: {
        id: ev.id,
        title: ev.title,
        description: ev.description || "",
        start: ev.all_day ? toDateInput(ev.start) : toLocalInput(ev.start),
        end: ev.all_day
          ? toDateInput(ev.end || ev.start)
          : toLocalInput(ev.end || ev.start),
        all_day: ev.all_day,
        color: ev.color || COLORS[0],
        recurrence: ev.recurrence || "none",
        recurrence_until: ev.recurrence_until
          ? toDateInput(ev.recurrence_until)
          : "",
      },
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const d = modal.data;
    if (!d.title.trim()) return;
    const start = d.all_day
      ? d.start.slice(0, 10)
      : new Date(d.start).toISOString();
    const end = d.end
      ? d.all_day
        ? d.end.slice(0, 10)
        : new Date(d.end).toISOString()
      : null;
    const body = {
      title: d.title,
      description: d.description,
      start,
      end,
      all_day: d.all_day,
      color: d.color,
      recurrence: d.recurrence,
      recurrence_until:
        d.recurrence === "none" ? null : d.recurrence_until || null,
    };
    try {
      if (modal.mode === "create") {
        await api("/api/events", {
          method: "POST",
          body: JSON.stringify(body),
        });
      } else {
        await api(`/api/events/${d.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    if (!confirm("Supprimer cet événement ?")) return;
    await api(`/api/events/${modal.data.id}`, { method: "DELETE" });
    setModal(null);
    load();
  };

  const handleDrop = async (info) => {
    const sid = info.event.extendedProps?.seriesId ?? info.event.id;
    const ev = events.find((e) => String(e.id) === String(sid));
    if (!ev) return;
    try {
      await api(`/api/events/${ev.id}`, {
        method: "PUT",
        body: JSON.stringify({
          start: info.event.start.toISOString(),
          end: info.event.end ? info.event.end.toISOString() : null,
        }),
      });
      load();
    } catch {
      info.revert();
    }
  };

  const handleResize = async (info) => {
    const sid = info.event.extendedProps?.seriesId ?? info.event.id;
    const ev = events.find((e) => String(e.id) === String(sid));
    if (!ev) return;
    try {
      await api(`/api/events/${ev.id}`, {
        method: "PUT",
        body: JSON.stringify({
          end: info.event.end ? info.event.end.toISOString() : null,
        }),
      });
      load();
    } catch {
      info.revert();
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={frLocale}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Aujourd'hui",
            month: "Mois",
            week: "Semaine",
            day: "Jour",
          }}
          selectable
          selectMirror
          dayMaxEvents={3}
          nowIndicator
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          height="auto"
          events={fcEvents}
          eventContent={renderEventContent}
          select={openCreate}
          dateClick={openCreate}
          eventClick={openEdit}
          editable
          eventDrop={handleDrop}
          eventResize={handleResize}
        />
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <form
            onSubmit={submit}
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3 my-8"
          >
            <h3 className="font-semibold text-lg">
              {modal.mode === "create"
                ? "Nouvel événement"
                : "Modifier l'événement"}
            </h3>
            <input
              autoFocus
              placeholder="Titre"
              value={modal.data.title}
              onChange={(e) =>
                setModal({
                  ...modal,
                  data: { ...modal.data, title: e.target.value },
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <textarea
              placeholder="Description"
              value={modal.data.description}
              onChange={(e) =>
                setModal({
                  ...modal,
                  data: { ...modal.data, description: e.target.value },
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={2}
            />

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={modal.data.all_day}
                onChange={(e) =>
                  setModal({
                    ...modal,
                    data: { ...modal.data, all_day: e.target.checked },
                  })
                }
              />
              Journée entière
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-600">Début</span>
                <input
                  type={modal.data.all_day ? "date" : "datetime-local"}
                  value={modal.data.start}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      data: { ...modal.data, start: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Fin</span>
                <input
                  type={modal.data.all_day ? "date" : "datetime-local"}
                  value={modal.data.end}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      data: { ...modal.data, end: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-600">Répétition</span>
                <select
                  value={modal.data.recurrence}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      data: { ...modal.data, recurrence: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {RECURRENCES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {modal.data.recurrence !== "none" && (
                <label className="block text-sm">
                  <span className="text-slate-600">Jusqu'au (optionnel)</span>
                  <input
                    type="date"
                    value={modal.data.recurrence_until}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        data: {
                          ...modal.data,
                          recurrence_until: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Couleur :</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setModal({ ...modal, data: { ...modal.data, color: c } })
                  }
                  className={`w-5 h-5 rounded-full border-2 ${
                    modal.data.color === c
                      ? "border-slate-800 scale-110"
                      : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>

            <p className="text-[11px] text-slate-400">
              L'assignation des personnes se fait directement sur chaque créneau
              du calendrier (vue semaine / jour), occurrence par occurrence.
            </p>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                {modal.mode === "create" ? "Créer" : "Enregistrer"}
              </button>
              {modal.mode === "edit" && (
                <button
                  type="button"
                  onClick={remove}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  Supprimer
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
