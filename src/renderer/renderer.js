const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const searchEl = document.getElementById('search');
const clearEl = document.getElementById('clear');

const confirmEl = document.getElementById('confirm');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmOkEl = document.getElementById('confirm-ok');
const confirmCancelEl = document.getElementById('confirm-cancel');

let items = [];
let selectedIndex = 0;
let pendingConfirm = null;

function askConfirm(message, onConfirm) {
  pendingConfirm = onConfirm;
  confirmMessageEl.textContent = message;
  confirmEl.hidden = false;
  confirmCancelEl.focus();
}

function closeConfirm(accepted) {
  const action = pendingConfirm;
  pendingConfirm = null;
  confirmEl.hidden = true;
  searchEl.focus();
  if (accepted && action) action();
}

confirmOkEl.addEventListener('click', () => closeConfirm(true));
confirmCancelEl.addEventListener('click', () => closeConfirm(false));

function filteredItems() {
  const query = searchEl.value.trim().toLowerCase();
  return query ? items.filter((i) => i.text.toLowerCase().includes(query)) : items;
}

function render() {
  const visible = filteredItems();
  selectedIndex = Math.min(selectedIndex, Math.max(visible.length - 1, 0));
  listEl.textContent = '';
  emptyEl.hidden = visible.length > 0;

  visible.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'item' + (index === selectedIndex ? ' selected' : '');
    li.addEventListener('click', () => window.clipboardApi.select(item.id));

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = item.text.slice(0, 500);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const pin = document.createElement('button');
    pin.className = 'pin' + (item.pinned ? ' active' : '');
    pin.title = item.pinned ? 'Unpin' : 'Pin';
    pin.textContent = item.pinned ? '★' : '☆';
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      window.clipboardApi.togglePin(item.id);
    });

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.title = 'Delete';
    remove.textContent = '✕';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      const message = item.pinned
        ? 'Delete this pinned item? This cannot be undone.'
        : 'Delete this item? This cannot be undone.';
      askConfirm(message, () => window.clipboardApi.remove(item.id));
    });

    actions.append(pin, remove);
    li.append(text, actions);
    listEl.append(li);
  });

  const selected = listEl.children[selectedIndex];
  if (selected) selected.scrollIntoView({ block: 'nearest' });
}

function moveSelection(delta) {
  const count = filteredItems().length;
  if (!count) return;
  selectedIndex = (selectedIndex + delta + count) % count;
  render();
}

searchEl.addEventListener('input', () => {
  selectedIndex = 0;
  render();
});

clearEl.addEventListener('click', () => {
  const count = items.filter((i) => !i.pinned).length;
  if (!count) return;
  askConfirm(
    `Delete ${count} unpinned item${count === 1 ? '' : 's'}? Pinned items are kept.`,
    () => window.clipboardApi.clearUnpinned()
  );
});

document.addEventListener('keydown', (e) => {
  if (!confirmEl.hidden) {
    // While the dialog is open, only Esc is handled here; Enter/Tab act on the focused button.
    if (e.key === 'Escape') {
      e.preventDefault();
      closeConfirm(false);
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveSelection(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveSelection(-1);
  } else if (e.key === 'Enter') {
    const item = filteredItems()[selectedIndex];
    if (item) window.clipboardApi.select(item.id);
  } else if (e.key === 'Escape') {
    window.clipboardApi.hide();
  }
});

window.clipboardApi.onHistoryUpdated((newItems) => {
  items = newItems;
  render();
});

window.clipboardApi.onWindowShown(() => {
  pendingConfirm = null;
  confirmEl.hidden = true;
  searchEl.value = '';
  selectedIndex = 0;
  searchEl.focus();
  render();
});

window.clipboardApi.getHistory().then((initial) => {
  items = initial;
  render();
});
