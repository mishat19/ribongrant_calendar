import { app, BrowserWindow, Menu } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envFile = new URL("../.env", import.meta.url);
if (!app.isPackaged && existsSync(envFile)) process.loadEnvFile(envFile);

const PREFERRED_PORT = Number(process.env.PORT) || 4000;

let mainWindow = null;
let server = null;

function listen(serverApp, port) {
  // Pas de callback sur app.listen() : Express 5 l'appellerait aussi en cas d'erreur.
  return new Promise((resolve, reject) => {
    const s = serverApp.listen(port);
    s.once("listening", () => resolve(s));
    s.once("error", (err) => {
      if (err.code === "EADDRINUSE" && !process.env.PORT) {
        const fallback = serverApp.listen(0);
        fallback.once("listening", () => resolve(fallback));
        fallback.once("error", reject);
      } else {
        reject(err);
      }
    });
  });
}

async function startServer() {
  if (app.isPackaged) {
    process.env.NODE_ENV = "production";
    process.env.APP_DATA_DIR = app.getPath("userData");
  } else {
    process.env.NODE_ENV = "development";
  }

  const { default: serverApp } = await import("../server/api.js");
  server = await listen(serverApp, PREFERRED_PORT);
  const actualPort = server.address().port;
  process.env.PORT = String(actualPort);
  if (actualPort !== PREFERRED_PORT) {
    console.warn(
      `[server] port ${PREFERRED_PORT} occupé, serveur démarré sur le port ${actualPort}`,
    );
  }
  return actualPort;
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Ribongrant Calendar",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = app.isPackaged ? `http://localhost:${port}` : "http://localhost:5173";
  mainWindow.loadURL(url);

  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
    mainWindow.webContents.on("before-input-event", (event, input) => {
      const isDevToolsShortcut =
        input.key === "F12" ||
        (input.control &&
          input.shift &&
          ["I", "J", "C"].includes(input.key.toUpperCase())) ||
        (input.meta && input.alt && input.key.toUpperCase() === "I");
      if (isDevToolsShortcut) event.preventDefault();
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  let port = PREFERRED_PORT;
  try {
    port = await startServer();
  } catch (err) {
    console.error("[server] failed to start:", err);
  }

  createWindow(port);

  app.on("activate", () => {
    if (mainWindow === null) createWindow(port);
  });
});

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});
