const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ribongrantPdf", {
  export: (payload) => ipcRenderer.invoke("pdf:export", payload),
});
