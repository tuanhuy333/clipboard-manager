const path = require('path');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
} = require('electron');
const { HistoryStore } = require('./store');

const WINDOW_WIDTH = 380;
const WINDOW_HEIGHT = 520;
const POLL_INTERVAL_MS = 500;
const SHORTCUT = 'CommandOrControl+Shift+V';
const IS_MAC = process.platform === 'darwin';

let tray = null;
let win = null;
let store = null;
let lastText = '';

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function createTray() {
  const assets = path.join(__dirname, '..', 'assets');
  const icon = nativeImage.createFromPath(
    path.join(assets, 'tray.png')
  );

  tray = new Tray(icon);
  tray.setToolTip('Clipboard Manager');
  tray.on('click', toggleWindow);
  tray.on('right-click', () => tray.popUpContextMenu(buildContextMenu()));
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    { label: `Open (${SHORTCUT.replace('CommandOrControl', IS_MAC ? 'Cmd' : 'Ctrl')})`, click: showWindow },
    {
      label: 'Clear unpinned history',
      click: async () => {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Cancel', 'Delete'],
          defaultId: 0,
          cancelId: 0,
          message: 'Delete all unpinned clipboard history?',
          detail: 'Pinned items are kept. This cannot be undone.',
        });
        if (response !== 1) return;
        store.clearUnpinned();
        notifyRenderer();
      },
    },
    { type: 'separator' },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function createWindow() {
  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    backgroundColor: '#17121a',
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) win.hide();
  });
}

/** Place the window next to the tray icon, falling back to the screen center. */
function positionWindow() {
  const trayBounds = tray.getBounds();
  const hasTrayBounds = trayBounds.width > 0 && trayBounds.height > 0;
  const point = hasTrayBounds
    ? { x: trayBounds.x, y: trayBounds.y }
    : screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(point);

  let x = Math.round(workArea.x + (workArea.width - WINDOW_WIDTH) / 2);
  let y = Math.round(workArea.y + (workArea.height - WINDOW_HEIGHT) / 2);

  if (hasTrayBounds) {
    x = Math.round(trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2);
    // Menu bar on top (macOS): open below it. Taskbar on bottom (Windows): open above it.
    const barOnTop = trayBounds.y < workArea.y + workArea.height / 2;
    y = barOnTop ? trayBounds.y + trayBounds.height + 4 : trayBounds.y - WINDOW_HEIGHT - 4;
  }

  x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - WINDOW_WIDTH);
  y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - WINDOW_HEIGHT);
  win.setPosition(x, y, false);
}

function showWindow() {
  positionWindow();
  win.show();
  win.focus();
  win.webContents.send('window-shown');
  notifyRenderer();
}

function toggleWindow() {
  if (win.isVisible()) win.hide();
  else showWindow();
}

function notifyRenderer() {
  if (win && !win.isDestroyed()) win.webContents.send('history-updated', store.list());
}

async function startClipboardWatcher() {
  lastText = await clipboard.readText();
  let polling = false;
  setInterval(async () => {
    if (polling) return; // skip if the previous read is still pending
    polling = true;
    try {
      const text = await clipboard.readText();
      if (text === lastText) return;
      lastText = text;
      if (store.add(text)) notifyRenderer();
    } catch (err) {
      console.error('Clipboard read failed:', err);
    } finally {
      polling = false;
    }
  }, POLL_INTERVAL_MS);
}

function registerIpc() {
  ipcMain.handle('history:get', () => store.list());

  ipcMain.on('history:select', async (_event, id) => {
    const item = store.get(id);
    if (!item) return;
    lastText = item.text; // prevent the watcher from treating this as a new copy
    await clipboard.writeText(item.text);
    store.add(item.text); // bump to top
    win.hide();
    notifyRenderer();
  });

  ipcMain.on('history:toggle-pin', (_event, id) => {
    store.togglePin(id);
    notifyRenderer();
  });

  ipcMain.on('history:remove', (_event, id) => {
    store.remove(id);
    notifyRenderer();
  });

  ipcMain.on('history:clear-unpinned', () => {
    store.clearUnpinned();
    notifyRenderer();
  });

  ipcMain.on('window:hide', () => win.hide());
}

app.whenReady().then(() => {
  if (IS_MAC) app.dock.hide();

  store = new HistoryStore(app.getPath('userData'));
  createTray();
  createWindow();
  registerIpc();
  startClipboardWatcher();

  if (!globalShortcut.register(SHORTCUT, toggleWindow)) {
    console.warn(`Could not register global shortcut ${SHORTCUT}`);
  }
});

app.on('second-instance', showWindow);
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (store) store.flush();
});
// Keep running in the tray when the window is closed/hidden.
app.on('window-all-closed', (event) => event.preventDefault());
