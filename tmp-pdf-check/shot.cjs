const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const target = process.argv[2] || "planning";
const width = Number(process.argv[3] || 733);
const out = process.argv[4] || target;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width,
    height: 800,
    webPreferences: { zoomFactor: 1 },
  });
  await win.loadFile(path.join(__dirname, `${target}.html`));
  await new Promise((r) => setTimeout(r, 400));
  const h = await win.webContents.executeJavaScript(
    "document.body.scrollHeight",
  );
  win.setSize(width, Math.min(h + 20, 4000));
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, out), img.toPNG());
  console.log("png written", out, h);
  app.quit();
});
