import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";
import { parseDate, eligibleMembers, isoWeek } from "../lib/availability.js";
import {
  buildWeekPlanningHtml,
  exportWeekPlanningPdf,
} from "../lib/weekPlanningPdf.js";
import {
  EVENT_BLOCK_CHROME_PX,
  buildSlotHeightCss,
  computeSlotRowHeights,
  eventMinutes,
  readBaseSlotHeight,
} from "../lib/timegridSlots.js";

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

function sameArray(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const DAY_MS = 86400000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

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
  const build = (start, end, id) => {
    const durationMs = end ? end.getTime() - start.getTime() : null;
    const longRunning =
      !ev.all_day && durationMs != null && durationMs >= DAY_MS;
    const eventStart = longRunning ? startOfDay(start) : start;
    const eventEnd = longRunning
      ? new Date(startOfDay(new Date(end.getTime() - 1)).getTime() + DAY_MS)
      : end;
    return {
      id,
      title: ev.title,
      start: eventStart,
      end: eventEnd,
      allDay: ev.all_day || longRunning,
      backgroundColor: color,
      borderColor: color,
      startEditable: !recurring,
      durationEditable: !recurring,
      extendedProps: { ...ext, occurrence: toDateInput(start) },
    };
  };

  const start = parseDate(ev.start);
  if (!start) return [];

  if (!recurring) {
    return [
      build(start, ev.end ? parseDate(ev.end) : undefined, String(ev.id)),
    ];
  }

  const end = ev.end ? parseDate(ev.end) : null;
  const rawDurationMs = end ? end - start : null;
  const durationMs =
    rawDurationMs == null
      ? null
      : rawDurationMs > 0
        ? rawDurationMs
        : ev.all_day
          ? 86400000
          : 3600000;
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

// Panneau d'assignation : largeur calée sur la tâche, portail hors du
// calendrier pour ne jamais être rogné par le conteneur de FullCalendar.
const PANEL_MIN_WIDTH = 190;
const PANEL_GAP = 6;
const PANEL_EDGE = 8;
const PANEL_CLOSE_DELAY = 220;

function formatTimeRange(event) {
  if (event.allDay) return "Journée entière";
  const start = event.start;
  if (!start) return "";
  const from = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const end = event.end;
  if (!end) return from;
  return `${from} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function AssignRow({ member, status, onClick }) {
  const isAssigned = status === "assigned";
  const isAvailable = status === "available";
  const isUnavailable = status === "unavailable";
  const base =
    "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition";
  const tone = isAssigned
    ? "bg-slate-50 font-semibold text-slate-900 hover:bg-slate-100"
    : isAvailable
      ? "text-slate-600 hover:bg-slate-100"
      : "cursor-not-allowed text-slate-300";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isUnavailable}
      className={`${base} ${tone}`}
      title={
        isAssigned
          ? `Retirer ${member.name}`
          : isAvailable
            ? `Assigner ${member.name}`
            : `${member.name} — indisponible sur ce créneau`
      }
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          isAssigned
            ? ""
            : isAvailable
              ? "border border-slate-300"
              : "bg-slate-200"
        }`}
        style={isAssigned ? { background: member.color } : undefined}
      />
      <span className="min-w-0 flex-1 truncate">{member.name}</span>
      {isAssigned ? (
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5 shrink-0 text-emerald-600"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      ) : null}
      {isUnavailable ? (
        <span className="shrink-0 text-[9px] uppercase tracking-wide">
          indispo
        </span>
      ) : null}
    </button>
  );
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
  const availableIds = new Set(available.map((m) => m.id));
  const addable = available.filter((m) => !assignedIds.includes(m.id));
  const unavailable = members.filter(
    (m) => !assignedIds.includes(m.id) && !availableIds.has(m.id),
  );
  const contentRef = useRef(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimer = useRef(null);
  const [panel, setPanel] = useState(null);

  useLayoutEffect(() => {
    if (!isTimeGrid) return;
    const el = contentRef.current;
    if (!el || !ctx.reportContentHeight) return;
    ctx.reportContentHeight({
      key: event.id,
      start: event.start,
      end: event.end,
      heightPx: Math.ceil(el.getBoundingClientRect().height),
    });
  });

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setPanel(null), PANEL_CLOSE_DELAY);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  // Le panneau se positionne sous la tâche (au-dessus si la place manque) et
  // prend exactement la largeur de la tâche.
  const openPanel = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(Math.round(rect.width), PANEL_MIN_WIDTH);
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const place = below < 260 && above > below ? "above" : "below";
    const maxLeft = Math.max(
      PANEL_EDGE,
      window.innerWidth - width - PANEL_EDGE,
    );
    const left = Math.min(Math.max(PANEL_EDGE, rect.left), maxLeft);
    setPanel({
      style:
        place === "below"
          ? { left, top: rect.bottom + PANEL_GAP, width }
          : { left, bottom: window.innerHeight - rect.top + PANEL_GAP, width },
    });
  }, []);

  // Le panneau suit le défilement de la page, il est donc refermé au scroll
  // et dès qu'on clique en dehors.
  useEffect(() => {
    if (!panel) return undefined;
    const close = () => setPanel(null);
    const onPointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [panel]);

  const toggleMember = (memberId) => {
    const next = assignedIds.includes(memberId)
      ? assignedIds.filter((x) => x !== memberId)
      : [...assignedIds, memberId];
    updateAssignments(event, next);
  };

  return (
    <div
      ref={rootRef}
      className="relative h-full"
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
    >
      {/* Résumé : toujours coupé à la hauteur du bloc */}
      <div className="h-full overflow-hidden px-1 py-0.5 text-[10px] leading-tight">
        <div ref={contentRef}>
          <div className="font-semibold truncate" title={event.title}>
            {event.title}
          </div>
          <div className="opacity-80">
            {available.length}/{total} dispo
          </div>
          {assigned.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {assigned.map((m) => (
                <div key={m.id} className="truncate opacity-90">
                  {m.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panneau d'assignation, monté hors du calendrier pour ne pas être coupé */}
      {panel &&
        isTimeGrid &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-40 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/15"
            style={panel.style}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: event.backgroundColor || COLORS[0] }}
              />
              <span
                className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-800"
                title={event.title}
              >
                {event.title}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                {formatTimeRange(event)}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto p-1">
              {assigned.length > 0 ? (
                <p className="px-1.5 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Affectés ({assigned.length})
                </p>
              ) : null}
              {assigned.map((m) => (
                <AssignRow
                  key={m.id}
                  member={m}
                  status="assigned"
                  onClick={() => toggleMember(m.id)}
                />
              ))}

              {addable.length > 0 ? (
                <p className="px-1.5 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Disponibles ({addable.length})
                </p>
              ) : null}
              {addable.map((m) => (
                <AssignRow
                  key={m.id}
                  member={m}
                  status="available"
                  onClick={() => toggleMember(m.id)}
                />
              ))}

              {members.length === 0 || addable.length === 0 ? (
                <p className="px-1.5 py-2 text-[11px] text-slate-400">
                  Aucun membre disponible.
                </p>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  useEffect(() => {
    setFormError(null);
  }, [modal]);
  const [error, setError] = useState(null);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState(null);
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

  const calendarRootRef = useRef(null);
  const slotStyleRef = useRef(null);
  const contentHeightsRef = useRef(new Map());
  const visibleRangeRef = useRef(null);
  const [slotLayout, setSlotLayout] = useState({
    rows: [],
    heights: [],
    basePx: 0,
  });

  // Recalcule la hauteur de chaque ligne horaire à partir du contenu mesuré
  // des tâches : une ligne s'agrandit pour que la tâche la plus haute qui la
  // traverse tienne entièrement.
  const applySlotHeights = useCallback(() => {
    const timegridEl = calendarRootRef.current?.querySelector(".fc-timegrid");
    if (!timegridEl) return;
    const axisCells = timegridEl.querySelectorAll(
      "td.fc-timegrid-slot-label[data-time]",
    );
    if (!axisCells.length) return;

    const rows = Array.from(axisCells, (el) => el.getAttribute("data-time"));
    const basePx = readBaseSlotHeight(timegridEl, axisCells[0]);
    const range = visibleRangeRef.current;
    const items = [];
    for (const info of contentHeightsRef.current.values()) {
      if (
        range &&
        info.start &&
        (info.start < range.start || info.start >= range.end)
      )
        continue;
      const minutes = eventMinutes(info.start, info.end);
      if (!minutes) continue;
      items.push({
        startMin: minutes.startMin,
        endMin: minutes.endMin,
        neededPx: info.heightPx + EVENT_BLOCK_CHROME_PX,
      });
    }

    const heights = computeSlotRowHeights({
      rowCount: rows.length,
      basePx,
      items,
    });
    setSlotLayout((prev) =>
      sameArray(prev.rows, rows) && sameArray(prev.heights, heights)
        ? prev
        : { rows, heights, basePx },
    );
  }, []);

  const reportContentHeight = useCallback(
    (info) => {
      contentHeightsRef.current.set(info.key, info);
      applySlotHeights();
    },
    [applySlotHeights],
  );

  // Retire les mesures des tâches supprimées.
  useEffect(() => {
    const valid = new Set(fcEvents.map((e) => e.id));
    let removed = false;
    for (const key of contentHeightsRef.current.keys()) {
      if (!valid.has(key)) {
        contentHeightsRef.current.delete(key);
        removed = true;
      }
    }
    if (removed) applySlotHeights();
  }, [fcEvents, applySlotHeights]);

  const ctxRef = useRef({ members: [], updateAssignments: () => {} });
  useEffect(() => {
    ctxRef.current = { members, updateAssignments, reportContentHeight };
  }, [members, updateAssignments, reportContentHeight]);
  const renderEventContent = useCallback(
    (arg) => <EventSlot arg={arg} ctx={ctxRef.current} />,
    [],
  );

  const slotCss = useMemo(
    () =>
      buildSlotHeightCss(
        slotLayout.rows,
        slotLayout.heights,
        slotLayout.basePx,
      ),
    [slotLayout],
  );
  useEffect(() => {
    const el = slotStyleRef.current;
    if (el) el.textContent = slotCss;
  }, [slotCss]);

  const handleDatesSet = useCallback((arg) => {
    if (arg?.start && arg?.end) {
      visibleRangeRef.current = { start: arg.start, end: arg.end };
    }
    const api = calRef.current?.getApi();
    if (!api) return;
    const date = api.getDate();
    setAnchorDate((prev) =>
      prev && prev.getTime() === date.getTime() ? prev : date,
    );
  }, []);

  const weekInfo = useMemo(() => {
    const start = new Date(anchorDate);
    start.setHours(0, 0, 0, 0);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const range =
      start.getMonth() === end.getMonth()
        ? `${start.getDate()} – ${end.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`
        : `${start.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })} – ${end.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}`;
    return { start, end, week: isoWeek(start), range };
  }, [anchorDate]);

  const exportWeek = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfMsg(null);
    try {
      const { start, end, week } = weekInfo;
      const endExclusive = new Date(end.getTime() + 86400000);
      const entries = [];
      for (const ev of fcEvents) {
        const s = ev.start ? new Date(ev.start) : null;
        if (!s) continue;
        const meta = ev.extendedProps || {};
        const e = ev.end
          ? new Date(ev.end)
          : new Date(s.getTime() + (ev.allDay ? 86400000 : 3600000));
        if (e <= start || s >= endExclusive) continue;
        const assigned = (meta.attributions || [])
          .filter((a) => a.occurrence === meta.occurrence)
          .map((a) => members.find((m) => m.id === a.member_id))
          .filter(Boolean)
          .map((m) => ({ name: m.name, color: m.color }));
        entries.push({
          title: ev.title,
          color: ev.backgroundColor || COLORS[0],
          start: s,
          end: e,
          allDay: !!ev.allDay,
          availableCount: eligibleMembers(members, s, !!ev.allDay).length,
          totalMembers: members.length,
          assigned,
        });
      }
      const html = buildWeekPlanningHtml({
        title: `Planning de la semaine ${week}`,
        subtitle: `Du ${start.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })} au ${end.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`,
        days: Array.from(
          { length: 7 },
          (_, i) => new Date(start.getTime() + i * 86400000),
        ),
        events: entries,
      });
      const result = await exportWeekPlanningPdf(
        html,
        `planning-semaine-${week}-${start.getFullYear()}.pdf`,
      );
      if (result?.error) {
        setPdfMsg({ kind: "error", text: result.error });
      } else if (result?.saved && result.path) {
        setPdfMsg({ kind: "ok", text: `PDF enregistré : ${result.path}` });
      }
    } catch (err) {
      setPdfMsg({ kind: "error", text: String(err?.message || err) });
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, weekInfo, fcEvents, members]);

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
    if (d.start && d.end) {
      const endsBeforeStart = d.all_day
        ? d.end.slice(0, 10) <= d.start.slice(0, 10)
        : new Date(d.end) <= new Date(d.start);
      if (endsBeforeStart) {
        setFormError(
          d.all_day
            ? "La date de fin doit être après la date de début."
            : "L'heure de fin doit être après l'heure de début.",
        );
        return;
      }
    }
    setFormError(null);
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
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">
              Semaine {weekInfo.week}
            </span>{" "}
            · {weekInfo.range}
          </p>
          <div className="flex items-center gap-3">
            {pdfMsg ? (
              <span
                className={
                  pdfMsg.kind === "error"
                    ? "text-xs text-red-600"
                    : pdfMsg.kind === "info"
                      ? "text-xs text-slate-500"
                      : "text-xs text-emerald-600"
                }
              >
                {pdfMsg.text}
              </span>
            ) : null}
            <button
              type="button"
              onClick={exportWeek}
              disabled={pdfBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
              </svg>
              {pdfBusy ? "Génération…" : "Télécharger le PDF de la semaine"}
            </button>
          </div>
        </div>
        <style ref={slotStyleRef} />
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
          slotMaxTime="24:00:00"
          slotDuration="01:00:00"
          height="auto"
          events={fcEvents}
          eventContent={renderEventContent}
          datesSet={handleDatesSet}
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
            {formError && <p className="text-sm text-red-600">{formError}</p>}
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
