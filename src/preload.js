const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipboardApi', {
  getHistory: () => ipcRenderer.invoke('history:get'),
  select: (id) => ipcRenderer.send('history:select', id),
  togglePin: (id) => ipcRenderer.send('history:toggle-pin', id),
  remove: (id) => ipcRenderer.send('history:remove', id),
  clearUnpinned: () => ipcRenderer.send('history:clear-unpinned'),
  hide: () => ipcRenderer.send('window:hide'),
  onHistoryUpdated: (cb) => ipcRenderer.on('history-updated', (_e, items) => cb(items)),
  onWindowShown: (cb) => ipcRenderer.on('window-shown', () => cb()),
});
