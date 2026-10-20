const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 28;
const GUTTER_WIDTH = 40;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

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

function layoutDay(segments) {
  const sorted = [...segments].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  );
  const result = [];
  let cluster = [];
  let clusterEnd = 0;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns = [];
    const assigned = cluster.map((segment) => {
      let col = columns.findIndex((colEnd) => colEnd <= segment.start);
      if (col === -1) {
        col = columns.length;
        columns.push(segment.end);
      } else {
        columns[col] = segment.end;
      }
      return { segment, col };
    });
    for (const { segment, col } of assigned) {
      result.push({ segment, column: col, columns: columns.length });
    }
    cluster = [];
  };

  for (const segment of sorted) {
    if (cluster.length > 0 && segment.start.getTime() >= clusterEnd) {
      flush();
      clusterEnd = 0;
    }
    cluster.push(segment);
    clusterEnd = Math.max(clusterEnd, segment.end.getTime());
  }
  flush();
  return result;
}

function renderEventBlock(placed) {
  const { segment, column, columns } = placed;
  const { entry } = segment;
  const startMinutes =
    segment.start.getHours() * 60 + segment.start.getMinutes();
  const endRaw = segment.end.getHours() * 60 + segment.end.getMinutes();
  const endMinutes = endRaw > startMinutes ? endRaw : END_HOUR * 60;
  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(
    ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
    14,
  );
  const leftPercent = (column / columns) * 100;
  const widthPercent = 100 / columns;
  const assigned = entry.assigned
    .map(
      (m) =>
        `<div class="who"><i class="dot" style="background:${m.color}"></i>${escapeHtml(m.name)}</div>`,
    )
    .join("");

  return `<div class="ev" style="left:calc(${leftPercent}% + 1px);width:calc(${widthPercent}% - 3px);top:${top}px;height:${height}px;border-left-color:${entry.color};background:${hexToRgba(entry.color, 0.14)};">
      <div class="etitle">${escapeHtml(entry.title)}</div>
      ${assigned}
    </div>`;
}

export function buildWeekPlanningHtml(data) {
  const { title, subtitle, days, events } = data;
  const todayKey = new Date().toDateString();

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

  const allDayEvents = events.filter((entry) => entry.allDay);
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

  const gutterLabels = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour += 1) {
    const y = (hour - START_HOUR) * HOUR_HEIGHT;
    if (hour === START_HOUR) {
      gutterLabels.push(`<div class="hlabel" style="top:2px">${pad(hour)}:00</div>`);
    } else {
      gutterLabels.push(
        `<div class="hlabel" style="top:${y}px;transform:translateY(-50%)">${pad(hour)}:00</div>`,
      );
    }
  }

  const gridColumns = days
    .map((day) => {
      const segments = events
        .filter((entry) => !entry.allDay)
        .flatMap((entry) => segmentsForDay(entry, day));
      const placed = layoutDay(segments);
      const lines = [];
      for (let hour = START_HOUR + 1; hour <= END_HOUR; hour += 1) {
        lines.push(
          `<div class="hline" style="top:${(hour - START_HOUR) * HOUR_HEIGHT}px"></div>`,
        );
      }
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      return `<div class="col${weekend ? " we" : ""}">${lines.join("")}${placed
        .map(renderEventBlock)
        .join("")}</div>`;
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
  .grid { border: 1px solid #DADCE0; border-radius: 4px; overflow: hidden; }
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
    height: ${GRID_HEIGHT}px;
    background: #FAFAFA;
  }
  .hlabel { position: absolute; right: 3px; font-size: 7px; color: #9AA0A6; line-height: 1; }
  .col {
    flex: 1;
    min-width: 0;
    position: relative;
    height: ${GRID_HEIGHT}px;
    border-left: 1px solid #DADCE0;
  }
  .col.we { background: #FAFAFA; }
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
  .dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    margin-right: 2px;
  }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">${escapeHtml(subtitle)}</div>
    </div>
    <div class="brand">Ribongrant Calendar</div>
  </div>
  <div class="grid">
    <div class="days"><div class="gutter"></div>${dayHeaders}</div>
    ${allDayEvents.length > 0 ? `<div class="allday"><div class="gutter">Journée</div>${allDayColumns}</div>` : ''}
    <div class="body">
      <div class="guttercol">${gutterLabels.join("")}</div>
      ${gridColumns}
    </div>
  </div>
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
