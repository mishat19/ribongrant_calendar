const START_HOUR = 6;
const END_HOUR = 24;
const BASE_HOUR_HEIGHT = 28;
const MIN_HOUR_HEIGHT = 15;
const GUTTER_WIDTH = 40;
const HOUR_ROWS = END_HOUR - START_HOUR;

// Hauteurs du contenu d'un bloc d'événement (px). Elles doivent rester
// cohérentes avec le CSS (police, interligne, marges internes) : le bloc est
// dimensionné à partir de ces valeurs pour que tous les bénévoles tiennent
// dans le créneau, même quand il y en a beaucoup.
const EV_PADDING_Y = 5;
const EV_TITLE_HEIGHT = 10;
const EV_WHO_HEIGHT = 9.5;

// Gabarit A4 portrait (297 x 210 mm), marges 8mm => zone imprimable ~1062px.
const PAGE_CONTENT_HEIGHT = 1062;
const HEAD_HEIGHT = 40;
const DAYS_ROW_HEIGHT = 22;
const ALLDAY_ROW_HEIGHT = 20;
// Marge de sécurité : la hauteur réelle des en-têtes dépend du rendu.
const PAGE_SAFETY = 18;
// Nombre de lignes horaires minimal sur une page (évite les pages quasi vides).
const MIN_PAGE_ROWS = 3;

const ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);

const pad = (n) => String(n).padStart(2, "0");

const capitalize = (text) =>
  text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;

function hexToRgba(hex, alpha) {
  const clean = String(hex).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(26, 115, 232, ${alpha})`;
  const num = parseInt(clean, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function effectiveEnd(entry) {
  if (entry.end > entry.start) return entry.end;
  const d = new Date(entry.start);
  d.setHours(d.getHours() + (entry.allDay ? 24 : 1));
  return d;
}

function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function segmentsForDay(entry, day) {
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const start = entry.start;
  const end = effectiveEnd(entry);
  if (end <= dayStart || start >= dayEnd) return [];
  if (entry.allDay) return [{ entry, start, end }];

  const windowStart = new Date(dayStart.getTime() + START_HOUR * 3600 * 1000);
  const windowEnd = new Date(dayStart.getTime() + END_HOUR * 3600 * 1000);
  const clippedStart = start > windowStart ? start : windowStart;
  const clippedEnd = end < windowEnd ? end : windowEnd;
  if (clippedEnd <= clippedStart) return [];
  return [{ entry, start: clippedStart, end: clippedEnd }];
}

/* ------------------------------------------------------------------ */
/* Modèle de hauteurs : une ligne horaire peut s'agrandir pour que le  */
/* contenu de tous les blocs qu'elle traverse tienne en entier.        */
/* ------------------------------------------------------------------ */

function rowIndexOf(minutes) {
  return clamp(
    Math.floor((minutes - START_HOUR * 60) / 60),
    0,
    HOUR_ROWS - 1,
  );
}

function lastRowIndexOf(minutes) {
  const raw = Math.ceil((minutes - START_HOUR * 60) / 60) - 1;
  return clamp(raw, 0, HOUR_ROWS - 1);
}

function rowStartOffset(rowHeights, row) {
  let y = 0;
  for (let i = 0; i < row; i += 1) y += rowHeights[i];
  return y;
}

function positionOf(minutes, rowHeights) {
  const offset = clamp(minutes - START_HOUR * 60, 0, HOUR_ROWS * 60);
  const row = clamp(Math.floor(offset / 60), 0, HOUR_ROWS - 1);
  return (
    rowStartOffset(rowHeights, row) +
    ((offset - row * 60) / 60) * rowHeights[row]
  );
}

function blockContentHeight(assignedCount) {
  return EV_PADDING_Y + EV_TITLE_HEIGHT + EV_WHO_HEIGHT * assignedCount;
}

function collectSegments(entries, day, range) {
  const segments = [];
  for (const entry of entries) {
    // Les tâches sur la journée entière sont affichées dans la ligne dédiée,
    // pas dans la grille horaire.
    if (entry.allDay) continue;
    for (const seg of segmentsForDay(entry, day)) {
      const startMin = minutesOf(seg.start);
      const endMin = minutesOf(seg.end);
      if (endMin <= startMin) continue;
      const clippedStart = Math.max(startMin, range.startMin);
      const clippedEnd = Math.min(endMin, range.endMin);
      if (clippedEnd <= clippedStart) continue;
      segments.push({ entry, startMin: clippedStart, endMin: clippedEnd });
    }
  }
  return segments;
}

// Répartit les segments sur des colonnes pour que les tâches qui se
// chevauchent dans le temps ne se recouvrent pas.
function layoutDay(segments) {
  const sorted = [...segments].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin,
  );
  const result = [];
  let cluster = [];
  let clusterEnd = 0;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns = [];
    const assigned = cluster.map((segment) => {
      let col = columns.findIndex((colEnd) => colEnd <= segment.startMin);
      if (col === -1) {
        col = columns.length;
        columns.push(segment.endMin);
      } else {
        columns[col] = segment.endMin;
      }
      return { segment, col };
    });
    for (const { segment, col } of assigned) {
      result.push({ segment, column: col, columns: columns.length });
    }
    cluster = [];
  };

  for (const segment of sorted) {
    if (cluster.length > 0 && segment.startMin >= clusterEnd) {
      flush();
      clusterEnd = 0;
    }
    cluster.push(segment);
    clusterEnd = Math.max(clusterEnd, segment.endMin);
  }
  flush();
  return result;
}

function computeRowHeights(segments) {
  const rowHeights = new Array(HOUR_ROWS).fill(BASE_HOUR_HEIGHT);
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const segment of segments) {
      const needed = blockContentHeight(segment.entry.assigned?.length ?? 0);
      const available =
        positionOf(segment.endMin, rowHeights) -
        positionOf(segment.startMin, rowHeights);
      if (available >= needed - 0.5) continue;
      const firstRow = rowIndexOf(segment.startMin);
      const lastRow = lastRowIndexOf(segment.endMin);
      const covered = Math.max(lastRow - firstRow + 1, 1);
      const extra = (needed - available) / covered;
      for (let row = firstRow; row <= lastRow; row += 1) {
        rowHeights[row] += extra;
      }
      changed = true;
    }
    if (!changed) break;
  }
  return rowHeights;
}

// Réduit les lignes horaires libres afin que le planning tienne sur une seule
// page quand c'est possible.
function compactFreeRows(rowHeights, busyRows, budget) {
  let total = rowHeights.reduce((sum, value) => sum + value, 0);
  if (total <= budget) return rowHeights;
  for (let row = 0; row < HOUR_ROWS && total > budget; row += 1) {
    if (busyRows.has(row)) continue;
    const reducible = rowHeights[row] - MIN_HOUR_HEIGHT;
    if (reducible <= 0.5) continue;
    const take = Math.min(reducible, total - budget);
    rowHeights[row] -= take;
    total -= take;
  }
  return rowHeights;
}

function rangeHeight(rowHeights, startRow, endRow) {
  let total = 0;
  for (let row = startRow; row < endRow; row += 1) total += rowHeights[row];
  return total;
}

// Ajuste la frontière entre deux pages pour ne pas couper une tâche en deux
// quand la page suivante peut l'accueillir.
function alignBoundary(startRow, endRow, rowHeights, segments, budget) {
  const crossing = segments.filter(
    (segment) =>
      segment.firstRow < endRow && segment.lastRow >= endRow,
  );
  if (crossing.length === 0) return endRow;

  let target = endRow;
  for (const segment of crossing) target = Math.max(target, segment.lastRow + 1);
  if (rangeHeight(rowHeights, startRow, target) <= budget) return target;

  const back = Math.min(...crossing.map((segment) => segment.firstRow));
  if (back > startRow && back - startRow >= MIN_PAGE_ROWS) return back;
  return endRow;
}

function splitIntoPages(rowHeights, segments) {
  const firstBudget =
    PAGE_CONTENT_HEIGHT -
    HEAD_HEIGHT -
    DAYS_ROW_HEIGHT -
    ALLDAY_ROW_HEIGHT -
    PAGE_SAFETY;
  const otherBudget = PAGE_CONTENT_HEIGHT - DAYS_ROW_HEIGHT - PAGE_SAFETY;
  const pages = [];
  let row = 0;
  let budget = firstBudget;
  while (row < HOUR_ROWS) {
    let end = row;
    let used = 0;
    while (end < HOUR_ROWS && used + rowHeights[end] <= budget) {
      used += rowHeights[end];
      end += 1;
    }
    if (end === row) end = row + 1;
    end = alignBoundary(row, end, rowHeights, segments, budget);
    pages.push({ startRow: row, endRow: end });
    row = end;
    budget = otherBudget;
  }
  return pages;
}

function renderEventBlock(placed, rowHeights, offset, columnHeight) {
  const { segment, column, columns } = placed;
  const { entry } = segment;
  const members = entry.assigned || [];
  const top = positionOf(segment.startMin, rowHeights) - offset;
  const bottom = positionOf(segment.endMin, rowHeights) - offset;
  const maxHeight = Math.max(columnHeight - top, 14);
  const available = Math.min(bottom - top, maxHeight);

  // Quand une tâche est coupée entre deux pages, on ne garde que les bénévoles
  // qui tiennent et on signale les autres (la liste complète est en bas de page).
  const room = Math.max(available - EV_PADDING_Y - EV_TITLE_HEIGHT, 0);
  let visibleCount = members.length;
  let hidden = 0;
  if (members.length * EV_WHO_HEIGHT > room) {
    visibleCount = Math.max(0, Math.floor(room / EV_WHO_HEIGHT));
    hidden = members.length - visibleCount;
    if (hidden > 0 && (visibleCount + 1) * EV_WHO_HEIGHT > room) {
      visibleCount = Math.max(0, visibleCount - 1);
      hidden = members.length - visibleCount;
    }
  }

  const lines = visibleCount + (hidden > 0 ? 1 : 0);
  const needed = EV_PADDING_Y + EV_TITLE_HEIGHT + EV_WHO_HEIGHT * lines;
  const height = Math.min(
    Math.max(Math.min(bottom - top, maxHeight), needed, 14),
    maxHeight,
  );
  const leftPercent = (column / columns) * 100;
  const widthPercent = 100 / columns;
  const assigned = members
    .slice(0, visibleCount)
    .map(
      (m) =>
        `<div class="who"><i class="dot" style="background:${m.color}"></i>${escapeHtml(m.name)}</div>`,
    )
    .join("");
  const more =
    hidden > 0
      ? `<div class="who more">+${hidden} autre${hidden > 1 ? "s" : ""}</div>`
      : "";

  return `<div class="ev" style="left:calc(${leftPercent}% + 1px);width:calc(${widthPercent}% - 3px);top:${top}px;height:${height}px;border-left-color:${entry.color};background:${hexToRgba(entry.color, 0.14)};">
      <div class="etitle">${escapeHtml(entry.title)}</div>
      ${assigned}
      ${more}
    </div>`;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60) % 24;
  return `${pad(hours)}:${pad(minutes % 60)}`;
}

// Liste exhaustive des affectations : les noms complets (non tronqués) et les
// tâches sur la journée entière y figurent, même si la grille ne peut pas
// tout afficher.
function renderDetail(days, entries) {
  const groups = days
    .map((day) => {
      const rows = entries
        .flatMap((entry) => segmentsForDay(entry, day))
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map((seg) => {
          const time = seg.entry.allDay
            ? "Journée"
            : `${formatTime(minutesOf(seg.start))}–${formatTime(minutesOf(seg.end))}`;
          const who = (seg.entry.assigned || [])
            .map(
              (m) =>
                `<i class="dot" style="background:${m.color}"></i>${escapeHtml(m.name)}`,
            )
            .join(", ");
          return `<div class="drow"><span class="dtime">${time}</span><span class="dname">${escapeHtml(seg.entry.title)}</span><span class="dwho">${who}</span></div>`;
        })
        .join("");
      if (!rows) return "";
      const label = `${capitalize(
        day.toLocaleDateString("fr-FR", { weekday: "long" }),
      )} ${day.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      })}`;
      return `<div class="dgroup"><div class="dday">${escapeHtml(label)}</div>${rows}</div>`;
    })
    .filter(Boolean)
    .join("");
  if (!groups) return "";
  return `<div class="detail"><h2>Détail des affectations</h2>${groups}</div>`;
}

export function buildWeekPlanningHtml(data) {
  const { title, subtitle, days, events } = data;
  const todayKey = new Date().toDateString();
  // Seuls les créneaux avec au moins une personne affectée sont affichés.
  const assignedEvents = events.filter(
    (entry) => (entry.assigned || []).length > 0,
  );

  const dayHeaders = days
    .map((day) => {
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      const today = day.toDateString() === todayKey;
      const name = capitalize(
        day.toLocaleDateString("fr-FR", { weekday: "long" }),
      );
      const num = day.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
      return `<div class="day${weekend ? " we" : ""}${today ? " today" : ""}">${name}<span class="num">${num}</span></div>`;
    })
    .join("");

  const allDayEvents = assignedEvents.filter((entry) => entry.allDay);
  const allDayColumns = days
    .map((day) => {
      const chips = allDayEvents
        .filter((entry) => segmentsForDay(entry, day).length > 0)
        .map(
          (entry) =>
            `<span class="chip" style="background:${entry.color}">${escapeHtml(entry.title)}</span>`,
        )
        .join("");
      return `<div class="col">${chips}</div>`;
    })
    .join("");

  // Toutes les occurrences de la semaine, sur toute la plage horaire.
  // Les tâches sur la journée entière sont exclues : elles ont leur propre
  // ligne en haut du planning.
  const weekSegments = days
    .flatMap((day) =>
      assignedEvents
        .filter((entry) => !entry.allDay)
        .flatMap((entry) =>
          segmentsForDay(entry, day).map((seg) => ({
            entry,
            startMin: minutesOf(seg.start),
            endMin: minutesOf(seg.end),
          })),
        ),
    )
    .filter((segment) => segment.endMin > segment.startMin);

  const rowHeights = computeRowHeights(weekSegments);

  const busyRows = new Set();
  for (const segment of weekSegments) {
    const firstRow = rowIndexOf(segment.startMin);
    const lastRow = lastRowIndexOf(segment.endMin);
    for (let row = firstRow; row <= lastRow; row += 1) busyRows.add(row);
  }
  const singlePageBudget =
    PAGE_CONTENT_HEIGHT -
    HEAD_HEIGHT -
    DAYS_ROW_HEIGHT -
    ALLDAY_ROW_HEIGHT -
    PAGE_SAFETY;
  compactFreeRows(rowHeights, busyRows, singlePageBudget);

  const pageSegments = weekSegments.map((segment) => ({
    ...segment,
    firstRow: rowIndexOf(segment.startMin),
    lastRow: lastRowIndexOf(segment.endMin),
  }));
  const pages = splitIntoPages(rowHeights, pageSegments);

  const pagesHtml = pages
    .map((page, pageIndex) => {
      const startMin = START_HOUR * 60 + page.startRow * 60;
      const endMin = START_HOUR * 60 + page.endRow * 60;
      const offset = rowStartOffset(rowHeights, page.startRow);
      const height = rangeHeight(rowHeights, page.startRow, page.endRow);

      const gutterLabels = [];
      for (let row = page.startRow; row < page.endRow; row += 1) {
        const hour = START_HOUR + row;
        const y = rowStartOffset(rowHeights, row) - offset;
        if (row === page.startRow) {
          gutterLabels.push(
            `<div class="hlabel" style="top:2px">${pad(hour)}:00</div>`,
          );
        } else {
          gutterLabels.push(
            `<div class="hlabel" style="top:${y}px;transform:translateY(-50%)">${pad(hour)}:00</div>`,
          );
        }
      }

      const gridColumns = days
        .map((day) => {
          const segments = collectSegments(assignedEvents, day, {
            startMin,
            endMin,
          });
          const placed = layoutDay(segments);
          const lines = [];
          for (let row = page.startRow + 1; row <= page.endRow; row += 1) {
            const y = rowStartOffset(rowHeights, row) - offset;
            lines.push(`<div class="hline" style="top:${y}px"></div>`);
          }
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          return `<div class="col${weekend ? " we" : ""}" style="height:${height}px">${lines.join("")}${placed
            .map((item) => renderEventBlock(item, rowHeights, offset, height))
            .join("")}</div>`;
        })
        .join("");

      const head =
        pageIndex === 0
          ? `<div class="head">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <div class="sub">${escapeHtml(subtitle)}</div>
      </div>
      <div class="brand">Ribongrant Calendar</div>
    </div>`
          : "";

      const allday =
        pageIndex === 0 && allDayEvents.length > 0
          ? `<div class="allday"><div class="gutter">Journée</div>${allDayColumns}</div>`
          : "";

      return `<div class="page">
    ${head}
    <div class="grid">
      <div class="days"><div class="gutter"></div>${dayHeaders}</div>
      ${allday}
      <div class="body">
        <div class="guttercol" style="height:${height}px">${gutterLabels.join("")}</div>
        ${gridColumns}
      </div>
    </div>
  </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Roboto, -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #202124;
    font-size: 8px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { break-after: page; page-break-after: always; }
  .page:last-of-type { break-after: auto; page-break-after: auto; }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 2px solid #1A73E8;
    padding-bottom: 5px;
    margin-bottom: 7px;
  }
  .head h1 { margin: 0; font-size: 15px; font-weight: 700; }
  .head .sub { margin-top: 2px; font-size: 9.5px; color: #5F6368; }
  .head .brand { font-size: 8px; color: #9AA0A6; white-space: nowrap; }
  .grid {
    border: 1px solid #DADCE0;
    border-radius: 4px;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .days { display: flex; background: #F8F9FA; border-bottom: 1px solid #DADCE0; }
  .days .gutter { width: ${GUTTER_WIDTH}px; flex: none; }
  .days .day {
    flex: 1;
    min-width: 0;
    text-align: center;
    padding: 3px 2px;
    font-size: 8.5px;
    font-weight: 600;
    border-left: 1px solid #DADCE0;
  }
  .days .day .num { margin-left: 3px; font-weight: 500; font-size: 7.5px; color: #5F6368; }
  .days .day.we { background: #F1F3F4; }
  .days .day.today, .days .day.today .num { color: #1A73E8; }
  .allday { display: flex; border-bottom: 1px solid #DADCE0; }
  .allday .gutter {
    width: ${GUTTER_WIDTH}px;
    flex: none;
    padding: 3px;
    font-size: 6.5px;
    color: #9AA0A6;
  }
  .allday .col {
    flex: 1;
    min-width: 0;
    border-left: 1px solid #DADCE0;
    padding: 2px;
    min-height: 15px;
  }
  .chip {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
    border-radius: 3px;
    color: #fff;
    font-size: 7px;
    font-weight: 600;
    padding: 1px 4px;
    margin: 1px 2px 1px 0;
  }
  .body { display: flex; }
  .guttercol {
    width: ${GUTTER_WIDTH}px;
    flex: none;
    position: relative;
    background: #FAFAFA;
  }
  .hlabel { position: absolute; right: 3px; font-size: 7px; color: #9AA0A6; line-height: 1; }
  .body .col {
    flex: 1;
    min-width: 0;
    position: relative;
    border-left: 1px solid #DADCE0;
  }
  .body .col.we { background: #FAFAFA; }
  .hline { position: absolute; left: 0; right: 0; border-top: 1px solid #E8EAED; }
  .ev {
    position: absolute;
    overflow: hidden;
    border-radius: 3px;
    border-left: 3px solid;
    padding: 2px 3px;
    line-height: 1.2;
  }
  .ev .etitle {
    font-size: 8px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ev .who {
    font-size: 7px;
    color: #5F6368;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ev .who.more { font-style: italic; color: #1A73E8; }
  .dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    margin-right: 2px;
  }
  .detail { margin-top: 10px; break-inside: auto; }
  .detail h2 {
    margin: 0 0 5px;
    font-size: 11px;
    font-weight: 700;
    border-bottom: 1px solid #DADCE0;
    padding-bottom: 3px;
  }
  .dgroup {
    margin-bottom: 6px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .dday {
    font-size: 9px;
    font-weight: 700;
    color: #1A73E8;
    margin-bottom: 1px;
  }
  .drow {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 1.5px 0;
    border-bottom: 1px dotted #E8EAED;
    font-size: 8px;
  }
  .dtime { width: 72px; flex: none; color: #5F6368; }
  .dname { width: 150px; flex: none; font-weight: 600; }
  .dwho { flex: 1; min-width: 0; color: #5F6368; }
</style>
</head>
<body>
  ${pagesHtml}
  ${renderDetail(days, assignedEvents)}
</body>
</html>`;
}

function printInBrowser(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden",
  );
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  iframe.contentWindow.addEventListener("afterprint", cleanup);
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(cleanup, 120000);
}

export async function exportWeekPlanningPdf(html, defaultName) {
  if (typeof window !== "undefined" && window.ribongrantPdf) {
    try {
      return await window.ribongrantPdf.export({ html, defaultName });
    } catch (err) {
      return { saved: false, error: String(err?.message || err) };
    }
  }
  printInBrowser(html);
  return { saved: true, printed: true };
}
