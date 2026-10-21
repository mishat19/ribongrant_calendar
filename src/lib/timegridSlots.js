// Calcul des hauteurs de lignes horaires pour les vues Semaine / Jour
// (FullCalendar timeGrid). Chaque ligne d'heure s'agrandit pour que la tâche
// la plus haute qui la traverse puisse afficher son contenu sans débordement.

export const SLOT_MIN_MINUTES = 6 * 60;
export const SLOT_DURATION_MINUTES = 60;

// Marges du bloc d'événement (bordures, padding interne, marge basse) : le
// contenu utile est un peu plus court que le bloc qui le contient.
export const EVENT_BLOCK_CHROME_PX = 6;

const DEFAULT_BASE_EM = 3;

function clampRow(row, rowCount) {
  return Math.min(Math.max(row, 0), Math.max(rowCount - 1, 0));
}

// Position verticale (en px) d'un instant, les hauteurs de lignes actuelles
// servant d'échelle. Reproduit le calcul de FullCalendar (coords des slats).
function positionOf(minutes, heights, slotMinMinutes, slotDurationMinutes) {
  const slot = (minutes - slotMinMinutes) / slotDurationMinutes;
  if (slot <= 0) return 0;
  const index = Math.floor(slot);
  let top = 0;
  for (let row = 0; row < Math.min(index, heights.length); row += 1) {
    top += heights[row];
  }
  const rowHeight = heights[clampRow(index, heights.length)] || 0;
  return top + (slot - index) * rowHeight;
}

/**
 * @param {object} options
 * @param {number} options.rowCount nombre de lignes horaires
 * @param {number} options.basePx hauteur minimale d'une ligne (px)
 * @param {Array<{startMin:number,endMin:number,neededPx:number}>} options.items
 * @returns {number[]} hauteur (px) de chaque ligne
 */
export function computeSlotRowHeights({
  rowCount,
  basePx,
  items,
  slotMinMinutes = SLOT_MIN_MINUTES,
  slotDurationMinutes = SLOT_DURATION_MINUTES,
}) {
  const heights = new Array(Math.max(rowCount, 0)).fill(basePx);
  if (!rowCount || !items?.length) return heights;

  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;
    for (const item of items) {
      const startSlot = (item.startMin - slotMinMinutes) / slotDurationMinutes;
      const endSlot = (item.endMin - slotMinMinutes) / slotDurationMinutes;
      if (!(endSlot > startSlot)) continue;

      const firstRow = clampRow(Math.floor(startSlot), rowCount);
      const lastRow = clampRow(Math.ceil(endSlot) - 1, rowCount);
      const covered = lastRow - firstRow + 1;
      if (covered <= 0) continue;

      const available =
        positionOf(item.endMin, heights, slotMinMinutes, slotDurationMinutes) -
        positionOf(item.startMin, heights, slotMinMinutes, slotDurationMinutes);
      if (available >= item.neededPx - 0.5) continue;

      const extra = (item.neededPx - available) / covered;
      for (let row = firstRow; row <= lastRow; row += 1) {
        heights[row] += extra;
      }
      changed = true;
    }
    if (!changed) break;
  }

  return heights;
}

/**
 * CSS des lignes à agrandir : la base reste pilotée par `--rg-slot-base`,
 * seule la supplément est appliqué ligne par ligne.
 */
export function buildSlotHeightCss(rows, heights, basePx) {
  if (!rows?.length || !heights?.length) return "";
  const parts = [];
  heights.forEach((height, index) => {
    const extra = height - basePx;
    if (extra <= 0.5) return;
    const time = rows[index];
    if (!time) return;
    parts.push(
      `.fc .fc-timegrid .fc-timegrid-slot[data-time="${time}"]{height:calc(var(--rg-slot-base) + ${Math.round(extra)}px)}`,
    );
  });
  return parts.join("\n");
}

/** Hauteur de base d'une ligne (px), déduite de `--rg-slot-base` et du corps du texte. */
export function readBaseSlotHeight(timegridEl, slotEl) {
  const declared = timegridEl
    ? parseFloat(
        getComputedStyle(timegridEl).getPropertyValue("--rg-slot-base"),
      )
    : NaN;
  const baseEm = Number.isFinite(declared) ? declared : DEFAULT_BASE_EM;
  const fontSize = slotEl
    ? parseFloat(getComputedStyle(slotEl).fontSize)
    : NaN;
  const fontPx = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  return baseEm * fontPx;
}

/** Bornes d'un événement en minutes depuis minuit. */
export function eventMinutes(start, end) {
  if (!start) return null;
  const startMin = start.getHours() * 60 + start.getMinutes();
  let endMin = startMin + 60;
  if (end) {
    const sameDay =
      end.getFullYear() === start.getFullYear() &&
      end.getMonth() === start.getMonth() &&
      end.getDate() === start.getDate();
    endMin = sameDay
      ? end.getHours() * 60 + end.getMinutes()
      : 24 * 60;
  }
  if (endMin <= startMin) endMin = startMin + 60;
  return { startMin, endMin };
}
