// In-game HUD. The root never intercepts pointer input (the canvas owns the
// mouse); only the pause overlay opts back into pointer events.

import { MODES, ROLES, PHASES } from '../core/constants.js';

const PHASE_LABELS = {
  [PHASES.LOBBY]: 'LOBBY',
  [PHASES.HIDING]: 'HIDE PHASE',
  [PHASES.SEEKING]: 'SEEK PHASE',
  [PHASES.ROUND_END]: 'ROUND OVER'
};

const FEED_MAX = 4;
const FEED_FADE_MS = 6000;
const BANNER_FADE_MS = 2500;

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * In-game heads-up display: phase/timer, role badge, monkey counter,
 * crosshair, kill-feed, banners, pause overlay and the police blindfold.
 * Emits `ui:resume` and `ui:leave`.
 */
export class HUD {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.role = null;
    this.phase = null;
    this._bannerTimers = [];

    this.el = document.createElement('div');
    this.el.className = 'screen hud-screen';
    this.el.hidden = true;
    this._build();
  }

  /**
   * Shows the HUD for a fresh round.
   * @param {{role: string, modeId: string, mapName: string, roomCode: string|null}} data
   */
  show(data) {
    this._reset();
    this._applyHudInfo(data);
    this.el.hidden = false;
  }

  /** Hides the HUD and clears pending banner timers. */
  hide() {
    this.el.hidden = true;
    this._clearBannerTimers();
  }

  /**
   * Routes gameplay events while in-game.
   * @param {string} event
   * @param {*} payload
   */
  update(event, payload) {
    switch (event) {
      case 'game:hud':
        this._applyHudInfo(payload);
        break;
      case 'game:phase':
        this._onPhase(payload);
        break;
      case 'game:timer':
        this._onTimer(payload.remainingSec);
        break;
      case 'game:monkeys':
        this._onMonkeys(payload);
        break;
      case 'game:banner':
        this.showBanner(payload.text, payload.subtext, payload.sticky);
        break;
      case 'game:feed':
        this._onFeed(payload.text);
        break;
      case 'game:pause':
        this._onPause(payload);
        break;
      case 'game:catch_target':
        this._crosshair.classList.toggle('target', Boolean(payload.visible));
        break;
    }
  }

  _build() {
    this.el.innerHTML = `
      <div class="hud-top-left">
        <div class="role-badge"></div>
        <div class="hud-mode-line"></div>
        <div class="hud-room-line" hidden></div>
      </div>
      <div class="hud-top-center">
        <div class="phase-label"></div>
        <div class="hud-timer" hidden></div>
      </div>
      <div class="hud-top-right">
        <div class="monkey-counter" hidden></div>
      </div>
      <div class="crosshair"></div>
      <div class="hud-feed"></div>
      <div class="hud-banner" hidden>
        <div class="banner-text"></div>
        <div class="banner-sub"></div>
      </div>
      <div class="blindfold" hidden>
        <div class="blindfold-text">The monkeys are hiding… 🙈</div>
        <div class="blindfold-count"></div>
      </div>
      <div class="pause-overlay" hidden>
        <div class="pause-box">
          <div class="pause-title">CLICK TO PLAY 🐒</div>
          <div class="pause-text"></div>
          <button type="button" class="btn btn-danger" data-action="leave">LEAVE</button>
          <div class="volume-section">
            <h3 class="volume-title">🔊 Sound</h3>
            <label class="volume-row"><span>Master</span><input type="range" class="volume-slider" data-channel="master" min="0" max="1" step="0.05" value="0.5"></label>
            <label class="volume-row"><span>SFX</span><input type="range" class="volume-slider" data-channel="sfx" min="0" max="1" step="0.05" value="0.8"></label>
            <label class="volume-row"><span>Ambient</span><input type="range" class="volume-slider" data-channel="ambient" min="0" max="1" step="0.05" value="0.4"></label>
            <label class="volume-row"><span>UI</span><input type="range" class="volume-slider" data-channel="ui" min="0" max="1" step="0.05" value="0.6"></label>
          </div>
        </div>
      </div>
    `;

    this._roleBadge = this.el.querySelector('.role-badge');
    this._modeLine = this.el.querySelector('.hud-mode-line');
    this._roomLine = this.el.querySelector('.hud-room-line');
    this._phaseLabel = this.el.querySelector('.phase-label');
    this._timer = this.el.querySelector('.hud-timer');
    this._counter = this.el.querySelector('.monkey-counter');
    this._crosshair = this.el.querySelector('.crosshair');
    this._feed = this.el.querySelector('.hud-feed');
    this._banner = this.el.querySelector('.hud-banner');
    this._blindfold = this.el.querySelector('.blindfold');
    this._blindfoldCount = this.el.querySelector('.blindfold-count');
    this._pause = this.el.querySelector('.pause-overlay');
    this._pauseText = this.el.querySelector('.pause-text');

    // ui:resume must be emitted synchronously inside the click handler so the
    // engine can request pointer lock within the user gesture.
    this._pause.addEventListener('click', () => this.bus.emit('ui:resume', {}));
    this._pause.querySelector('[data-action="leave"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.bus.emit('ui:leave', {});
    });
    for (const slider of this.el.querySelectorAll('.volume-slider')) {
      slider.addEventListener('input', () => {
        this.bus.emit('ui:volume', { channel: slider.dataset.channel, value: parseFloat(slider.value) });
      });
    }
  }

  _reset() {
    this.phase = null;
    this._clearBannerTimers();
    this._banner.hidden = true;
    this._blindfold.hidden = true;
    this._pause.hidden = true;
    this._counter.hidden = true;
    this._timer.hidden = true;
    this._timer.classList.remove('urgent');
    this._crosshair.classList.remove('target');
    this._feed.innerHTML = '';
    this._phaseLabel.textContent = '';
  }

  _applyHudInfo({ role, modeId, mapName, roomCode }) {
    this.role = role;
    if (role === ROLES.POLICE) {
      this._roleBadge.className = 'role-badge police';
      this._roleBadge.textContent = '👮 POLICE — catch the monkeys!';
    } else {
      this._roleBadge.className = 'role-badge monkey';
      this._roleBadge.textContent = '🐒 MONKEY — hide!';
    }
    const mode = MODES[modeId];
    this._modeLine.textContent = `${mode ? mode.name : modeId} · ${mapName}`;
    this._roomLine.hidden = !roomCode;
    if (roomCode) this._roomLine.textContent = `ROOM ${roomCode}`;
  }

  _onPhase({ phase, remainingSec }) {
    const prevPhase = this.phase;
    this.phase = phase;
    this._phaseLabel.textContent = PHASE_LABELS[phase] || '';
    this._onTimer(remainingSec);

    if (phase === PHASES.HIDING && this.role === ROLES.POLICE) {
      this._blindfold.hidden = false;
      if (remainingSec != null) this._blindfoldCount.textContent = formatTime(remainingSec);
    } else if (!this._blindfold.hidden) {
      this._blindfold.hidden = true;
      if (phase === PHASES.SEEKING && prevPhase === PHASES.HIDING) {
        this.showBanner('GO! 🚨');
      }
    }
  }

  _onTimer(remainingSec) {
    if (remainingSec == null) {
      this._timer.hidden = true;
      this._timer.classList.remove('urgent');
      return;
    }
    this._timer.hidden = false;
    this._timer.textContent = formatTime(remainingSec);
    this._timer.classList.toggle('urgent', remainingSec <= 10);
    if (!this._blindfold.hidden) this._blindfoldCount.textContent = formatTime(remainingSec);
  }

  _onMonkeys({ remaining, total }) {
    this._counter.hidden = false;
    this._counter.textContent = `🐒 ${remaining}/${total}`;
  }

  _onFeed(text) {
    const entry = document.createElement('div');
    entry.className = 'feed-entry';
    entry.textContent = text;
    this._feed.appendChild(entry);
    while (this._feed.children.length > FEED_MAX) {
      this._feed.firstElementChild.remove();
    }
    setTimeout(() => {
      entry.classList.add('fade');
      setTimeout(() => entry.remove(), 800);
    }, FEED_FADE_MS);
  }

  /**
   * Shows the big center banner.
   * @param {string} text
   * @param {string} [subtext]
   * @param {boolean} [sticky] keep on screen until the next banner replaces it
   */
  showBanner(text, subtext, sticky) {
    this._clearBannerTimers();
    this._banner.querySelector('.banner-text').textContent = text;
    this._banner.querySelector('.banner-sub').textContent = subtext || '';
    this._banner.hidden = false;
    this._banner.classList.remove('fade-out', 'drop');
    // Force a reflow so the drop animation restarts on back-to-back banners.
    void this._banner.offsetWidth;
    this._banner.classList.add('drop');

    if (!sticky) {
      this._bannerTimers.push(
        setTimeout(() => {
          this._banner.classList.add('fade-out');
          this._bannerTimers.push(setTimeout(() => (this._banner.hidden = true), 600));
        }, BANNER_FADE_MS)
      );
    }
  }

  _onPause({ visible, text }) {
    this._pause.hidden = !visible;
    if (visible) this._pauseText.textContent = text || '';
  }

  _clearBannerTimers() {
    for (const t of this._bannerTimers) clearTimeout(t);
    this._bannerTimers = [];
  }
}
