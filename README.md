# Clipboard Manager

A small cross-platform (macOS + Windows) clipboard history app that lives in the menu bar / system tray.

## Features

- Automatically records copied text
- Search, pin (pinned items stay on top and survive "Clear"), delete
- Click or press Enter to copy an item back to the clipboard
- Global shortcut: `Cmd+Shift+V` (macOS) / `Ctrl+Shift+V` (Windows)
- Optional launch at login (tray right-click menu)
- History stored locally in the app's user data folder (max 500 unpinned items)

## Development

```bash
npm install
npm run icons   # regenerate tray icons (optional, already in assets/)
npm start
```

## Build installers

```bash
npm run dist:mac   # .dmg (run on macOS)
npm run dist:win   # .exe installer (run on Windows)
```

## Project layout

- `src/main.js` – tray, window, clipboard watcher, IPC
- `src/store.js` – history persistence
- `src/preload.js` – safe bridge between main and UI
- `src/renderer/` – UI (HTML/CSS/JS)
