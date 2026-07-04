// Main menu: logo, name entry, Solo / Multiplayer tabs with mode & map
// pickers, and a room-code join form.

import { MODES, MAPS } from '../core/constants.js';

const NAME_KEY = 'monkeyalarm.name';
const DEFAULT_NAME = 'Officer';

/**
 * Returns modes available for a menu tab based on availability flags:
 * `solo: true` → Solo tab only, `multiplayerOnly: true` → Multiplayer tab
 * only, neither → both tabs.
 * @param {'solo'|'multi'} tab
 * @returns {Array<object>}
 */
function modesForTab(tab) {
  return Object.values(MODES).filter((mode) => {
    if (mode.solo) return tab === 'solo';
    if (mode.multiplayerOnly) return tab === 'multi';
    return true;
  });
}

/**
 * Main menu screen. Emits `ui:solo_start`, `ui:host`, and `ui:join`.
 */
export class MainMenu {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.activeTab = 'solo';
    // Per-tab selections so switching tabs never leaves an invalid mode id.
    this.selection = {
      solo: { modeId: 'CLASSIC', mapId: 'JUNGLE_TEMPLE' },
      multi: { modeId: 'CLASSIC', mapId: 'JUNGLE_TEMPLE' }
    };

    this.el = document.createElement('div');
    this.el.className = 'screen menu-screen';
    this.el.hidden = true;
    this._render();
  }

  /** Shows the menu and re-renders it fresh. */
  show() {
    this._render();
    this.el.hidden = false;
  }

  /** Hides the menu. */
  hide() {
    this.el.hidden = true;
  }

  /** @returns {string} trimmed player name (falls back to the default). */
  _getName() {
    const input = this.el.querySelector('.name-input');
    const name = (input ? input.value : '').trim() || DEFAULT_NAME;
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* storage unavailable (private mode etc.) — non-fatal */
    }
    return name;
  }

  _storedName() {
    try {
      return localStorage.getItem(NAME_KEY) || DEFAULT_NAME;
    } catch {
      return DEFAULT_NAME;
    }
  }

  _render() {
    this.el.innerHTML = `
      <div class="menu-floaters">${this._floatersHTML()}</div>
      <div class="menu-content">
        <h1 class="logo">
          <span class="logo-emoji">🚨</span>MONKEYALARM!<span class="logo-emoji">🐒</span>
        </h1>
        <p class="tagline">The monkeys are loose. You're the law.</p>
        <div class="menu-panel">
          <label class="name-row">
            <span>OFFICER NAME</span>
            <input class="name-input" type="text" maxlength="16" spellcheck="false" />
          </label>
          <div class="tabs">
            <button type="button" class="tab-btn" data-tab="solo">SOLO 🐒</button>
            <button type="button" class="tab-btn" data-tab="multi">MULTIPLAYER 👮</button>
          </div>
          <div class="tab-panel" data-panel="solo">
            <p class="section-label">GAME MODE</p>
            <div class="card-grid" data-cards="solo-mode"></div>
            <p class="section-label">MAP</p>
            <div class="card-grid" data-cards="solo-map"></div>
            <div class="menu-actions">
              <button type="button" class="btn btn-big" data-action="solo-play">PLAY 🍌</button>
            </div>
          </div>
          <div class="tab-panel" data-panel="multi">
            <div class="multi-cols">
              <div class="multi-col">
                <h2 class="col-title">HOST A GAME</h2>
                <p class="section-label">GAME MODE</p>
                <div class="card-grid" data-cards="multi-mode"></div>
                <p class="section-label">MAP</p>
                <div class="card-grid" data-cards="multi-map"></div>
                <div class="menu-actions">
                  <button type="button" class="btn btn-big btn-blue" data-action="host">HOST 🚨</button>
                </div>
              </div>
              <div class="multi-col multi-join">
                <h2 class="col-title">JOIN A GAME</h2>
                <p class="join-hint">Ask the host for their 4-letter room code.</p>
                <input class="join-code-input" type="text" maxlength="4"
                  placeholder="ABCD" spellcheck="false" autocomplete="off" />
                <div class="menu-actions">
                  <button type="button" class="btn btn-big" data-action="join" disabled>JOIN 🐵</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const nameInput = this.el.querySelector('.name-input');
    nameInput.value = this._storedName();
    nameInput.addEventListener('change', () => {
      try {
        localStorage.setItem(NAME_KEY, nameInput.value.trim() || DEFAULT_NAME);
      } catch {
        /* storage unavailable — non-fatal */
      }
    });

    this._renderCards('solo-mode', modesForTab('solo'), 'modeId', 'solo');
    this._renderCards('solo-map', Object.values(MAPS), 'mapId', 'solo');
    this._renderCards('multi-mode', modesForTab('multi'), 'modeId', 'multi');
    this._renderCards('multi-map', Object.values(MAPS), 'mapId', 'multi');

    this._bind();
    this._setTab(this.activeTab);
  }

  _floatersHTML() {
    const emojis = ['🍌', '🐒', '🍌', '🍌', '🐒', '🍌', '🌴', '🍌', '🐒', '🍌'];
    return emojis
      .map((emoji, i) => {
        const left = (i * 9.7 + 3) % 100;
        const duration = 14 + ((i * 5) % 11);
        const delay = -((i * 3.7) % 14);
        const size = 1.4 + ((i * 7) % 10) / 6;
        return (
          `<span class="floater" style="left:${left}%;font-size:${size.toFixed(2)}rem;` +
          `animation-duration:${duration}s;animation-delay:${delay}s">${emoji}</span>`
        );
      })
      .join('');
  }

  /**
   * Fills a card grid and wires selection.
   * @param {string} slot data-cards key
   * @param {Array<object>} items entries with { id, name, description|theme }
   * @param {'modeId'|'mapId'} field selection field to update
   * @param {'solo'|'multi'} tab which tab's selection to update
   */
  _renderCards(slot, items, field, tab) {
    const grid = this.el.querySelector(`[data-cards="${slot}"]`);
    grid.innerHTML = items
      .map(
        (item) => `
        <button type="button" class="card" data-id="${item.id}">
          <span class="card-name">${item.name}</span>
          <span class="card-desc">${item.description || item.theme || ''}</span>
        </button>`
      )
      .join('');

    const sync = () => {
      for (const card of grid.querySelectorAll('.card')) {
        card.classList.toggle('selected', card.dataset.id === this.selection[tab][field]);
      }
    };
    // Fall back to the first item if the remembered id isn't in this list.
    if (!items.some((item) => item.id === this.selection[tab][field])) {
      this.selection[tab][field] = items[0].id;
    }
    sync();

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      this.selection[tab][field] = card.dataset.id;
      sync();
    });
  }

  _bind() {
    for (const btn of this.el.querySelectorAll('.tab-btn')) {
      btn.addEventListener('click', () => this._setTab(btn.dataset.tab));
    }

    this.el.querySelector('[data-action="solo-play"]').addEventListener('click', () => {
      const { modeId, mapId } = this.selection.solo;
      this.bus.emit('ui:solo_start', { name: this._getName(), modeId, mapId });
    });

    this.el.querySelector('[data-action="host"]').addEventListener('click', () => {
      const { modeId, mapId } = this.selection.multi;
      this.bus.emit('ui:host', { name: this._getName(), modeId, mapId });
    });

    const codeInput = this.el.querySelector('.join-code-input');
    const joinBtn = this.el.querySelector('[data-action="join"]');
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      joinBtn.disabled = codeInput.value.length !== 4;
    });
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !joinBtn.disabled) joinBtn.click();
    });
    joinBtn.addEventListener('click', () => {
      this.bus.emit('ui:join', { name: this._getName(), roomCode: codeInput.value });
    });
  }

  _setTab(tab) {
    this.activeTab = tab;
    for (const btn of this.el.querySelectorAll('.tab-btn')) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    }
    for (const panel of this.el.querySelectorAll('.tab-panel')) {
      panel.classList.toggle('active', panel.dataset.panel === tab);
    }
  }
}
