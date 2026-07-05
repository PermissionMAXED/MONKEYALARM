// Top-level UI controller. Owns screen switching, the global toast system,
// and the (inline) loading screen. All game state arrives via `game:*` bus
// events; screens emit `ui:*` events back to the engine.

import { bus } from '../core/EventBus.js';
import { MainMenu } from './MainMenu.js';
import { LobbyScreen } from './LobbyScreen.js';
import { HUD } from './HUD.js';
import { RoundEndScreen } from './RoundEndScreen.js';

const TOAST_MS = 4000;

// Events that switch the visible screen, mapped to a screen key.
const SCREEN_EVENTS = {
  'game:menu': 'menu',
  'game:lobby': 'lobby',
  'game:loading': 'loading',
  'game:hud': 'hud',
  'game:roundend': 'roundend'
};

// Events that update whichever screen is currently visible.
const UPDATE_EVENTS = [
  'game:phase',
  'game:timer',
  'game:monkeys',
  'game:banner',
  'game:feed',
  'game:pause',
  'game:catch_target',
  'game:flash',
  'game:escape',
  'game:item',
  'game:cutscene:start',
  'game:cutscene:sub',
  'game:cutscene:end'
];

/**
 * Instantiates every screen, mounts them into the UI root, and routes all
 * `game:*` events. Exactly one main screen is visible at a time; the menu is
 * shown immediately on construction.
 */
export class UIManager {
  /**
   * @param {HTMLElement} rootEl the `#ui-root` overlay element
   */
  constructor(rootEl) {
    this.root = rootEl;
    this.bus = bus;

    this.screens = {
      menu: new MainMenu(bus),
      lobby: new LobbyScreen(bus),
      loading: this._createLoadingScreen(),
      hud: new HUD(bus),
      roundend: new RoundEndScreen(bus)
    };
    this.active = null;

    for (const screen of Object.values(this.screens)) {
      this.root.appendChild(screen.el);
    }

    this._toastContainer = document.createElement('div');
    this._toastContainer.className = 'toast-container';
    this.root.appendChild(this._toastContainer);

    // One delegated listener: any button click anywhere in the UI plays the
    // click sound (AudioManager listens for ui:click).
    this.root.addEventListener('click', (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('button')) {
        bus.emit('ui:click', {});
      }
    });

    this._subscribe();

    // Show the menu right away so there is no blank first frame; the engine
    // also emits game:menu on start, which simply re-shows it.
    this._showScreen('menu', {});
  }

  _subscribe() {
    for (const [event, key] of Object.entries(SCREEN_EVENTS)) {
      this.bus.on(event, (payload) => {
        this._showScreen(key, payload, event);
        if (event === 'game:menu' && payload && payload.error) {
          this.toast(payload.error);
        }
      });
    }
    for (const event of UPDATE_EVENTS) {
      this.bus.on(event, (payload) => {
        if (this.active && typeof this.active.update === 'function') {
          this.active.update(event, payload);
        }
      });
    }
    this.bus.on('game:toast', ({ message }) => this.toast(message));
  }

  /**
   * Switches to (or refreshes) a main screen.
   * @param {string} key screen key
   * @param {*} payload event payload passed to show()/update()
   * @param {string} [event] originating event name (for in-place updates)
   */
  _showScreen(key, payload, event) {
    const next = this.screens[key];
    if (this.active === next) {
      // Same screen re-announced: refresh in place rather than resetting all
      // transient state (e.g. a game:hud role change mid-round).
      if (typeof next.update === 'function' && event) {
        next.update(event, payload);
      } else {
        next.show(payload);
      }
      return;
    }
    if (this.active) this.active.hide();
    this.active = next;
    next.show(payload);
  }

  /**
   * Shows a top-center toast that auto-dismisses after 4 seconds.
   * @param {string} message
   */
  toast(message) {
    if (!message) return;
    const toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.textContent = message;
    this._toastContainer.appendChild(toastEl);
    setTimeout(() => {
      toastEl.classList.add('toast-out');
      setTimeout(() => toastEl.remove(), 400);
    }, TOAST_MS);
  }

  /**
   * Simple loading screen ("Loading Jungle Temple…"), small enough to live
   * inline rather than in its own module.
   */
  _createLoadingScreen() {
    const el = document.createElement('div');
    el.className = 'screen loading-screen';
    el.hidden = true;
    el.innerHTML = `
      <div class="loading-box">
        <div class="loading-spinner">🐒</div>
        <div class="loading-text"></div>
      </div>
    `;
    const textEl = el.querySelector('.loading-text');
    return {
      el,
      show(data) {
        const mapName = data && data.mapName ? data.mapName : '';
        textEl.textContent = mapName ? `Loading ${mapName}…` : 'Loading…';
        el.hidden = false;
      },
      hide() {
        el.hidden = true;
      }
    };
  }
}
