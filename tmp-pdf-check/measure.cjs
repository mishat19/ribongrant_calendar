const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const zlib = require("node:zlib");

const target = process.argv[2] || "planning";

function pdfStats(buffer) {
  const text = buffer.toString("latin1");
  const streams = [];
  const re = /stream\r?\n/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const end = text.indexOf("endstream", start);
    if (end === -1) continue;
    try {
      streams.push(zlib.inflateSync(buffer.subarray(start, end)).toString("latin1"));
    } catch {
      /* flux non compressé : ignoré */
    }
  }
  return {
    pages: (text.match(/\/Type\s*\/Page[^s]/g) || []).length,
    textOps: streams.reduce((sum, s) => sum + (s.match(/TJ|Tj/g) || []).length, 0),
  };
}

app.whenReady().then(async () => {
  // Largeur utile d'une A4 (194mm) pour reproduire la mise en page impression.
  const win = new BrowserWindow({ show: false, width: 733, height: 1100 });
  await win.loadFile(path.join(__dirname, `${target}.html`));
  const result = await win.webContents.executeJavaScript(`(() => {
    const evs = [...document.querySelectorAll('.ev')];
    return {
      pages: document.querySelectorAll('.page').length,
      gridHeights: [...document.querySelectorAll('.grid')].map((g) => Math.round(g.getBoundingClientRect().height)),
      evs: evs.map((el) => ({
        title: el.querySelector('.etitle')?.textContent,
        shown: el.querySelectorAll('.who:not(.more)').length,
        more: el.querySelector('.who.more')?.textContent ?? null,
        clipped: el.scrollHeight > el.offsetHeight + 0.5,
        ellipsized: [...el.querySelectorAll('.who:not(.more)')].some((w) => w.scrollWidth > w.clientWidth + 0.5),
      })),
      clippedBlocks: evs.filter((el) => el.scrollHeight > el.offsetHeight + 0.5).length,
      detailRows: document.querySelectorAll('.drow').length,
      detailRowsClipped: [...document.querySelectorAll('.drow')].filter((r) => r.scrollWidth > r.clientWidth + 0.5).length,
      bodyScrollHeight: document.body.scrollHeight,
    };
  })()`);
  console.log(JSON.stringify(result, null, 2));
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
  });
  fs.writeFileSync(path.join(__dirname, `${target}.pdf`), pdf);
  console.log("pdf", JSON.stringify(pdfStats(pdf)));
  app.quit();
});
