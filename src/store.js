const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_UNPINNED = 500;
const MAX_TEXT_LENGTH = 100000;

class HistoryStore {
  constructor(dir) {
    this.file = path.join(dir, 'history.json');
    this.items = [];
    this.saveTimer = null;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(data)) this.items = data;
    } catch {
      this.items = [];
    }
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    clearTimeout(this.saveTimer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.items));
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  }

  /** Add text to history, or move an existing identical entry to the top. */
  add(text) {
    if (!text || !text.trim() || text.length > MAX_TEXT_LENGTH) return false;
    const existing = this.items.find((i) => i.text === text);
    if (existing) {
      existing.createdAt = Date.now();
    } else {
      this.items.push({ id: crypto.randomUUID(), text, pinned: false, createdAt: Date.now() });
      this.trim();
    }
    this.save();
    return true;
  }

  trim() {
    const unpinned = this.items
      .filter((i) => !i.pinned)
      .sort((a, b) => b.createdAt - a.createdAt);
    const drop = new Set(unpinned.slice(MAX_UNPINNED).map((i) => i.id));
    if (drop.size) this.items = this.items.filter((i) => !drop.has(i.id));
  }

  get(id) {
    return this.items.find((i) => i.id === id);
  }

  togglePin(id) {
    const item = this.get(id);
    if (item) {
      item.pinned = !item.pinned;
      this.save();
    }
  }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    this.save();
  }

  clearUnpinned() {
    this.items = this.items.filter((i) => i.pinned);
    this.save();
  }

  /** Pinned first, then newest first. */
  list() {
    return [...this.items].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt
    );
  }
}

module.exports = { HistoryStore };
