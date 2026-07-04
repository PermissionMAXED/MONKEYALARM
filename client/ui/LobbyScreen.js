// Multiplayer lobby: giant copyable room code, live player list, host-only
// mode/map settings, ready toggle and start/leave actions. Fully re-rendered
// from every `game:lobby` payload so it never shows stale state.

import { MODES, MAPS } from '../core/constants.js';

function escapeHTML(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Lobby screen. Emits `ui:settings`, `ui:ready`, `ui:start_game`, `ui:leave`.
 */
export class LobbyScreen {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.data = null;
    this._copyTimer = null;

    this.el = document.createElement('div');
    this.el.className = 'screen lobby-screen';
    this.el.hidden = true;
  }

  /**
   * Shows the lobby with fresh data.
   * @param {{roomCode: string, selfId: string, players: Array<object>, modeId: string, mapId: string}} data
   */
  show(data) {
    this._render(data);
    this.el.hidden = false;
  }

  /** Hides the lobby. */
  hide() {
    this.el.hidden = true;
  }

  /**
   * Routes screen-level updates while visible.
   * @param {string} event
   * @param {*} payload
   */
  update(event, payload) {
    if (event === 'game:lobby') this._render(payload);
  }

  _render(data) {
    this.data = data;
    const { roomCode, selfId, players, modeId, mapId } = data;
    const self = players.find((p) => p.id === selfId);
    const isHost = Boolean(self && self.isHost);
    const others = players.filter((p) => !p.isHost);
    const allOthersReady = others.every((p) => p.ready);
    const totalPlayers = players.length + (data.botCount || 0);
    const canStart = totalPlayers >= 2 && allOthersReady;

    // Modes selectable in a multiplayer lobby: everything not solo-only.
    const modes = Object.values(MODES).filter((m) => !m.solo);
    const maps = Object.values(MAPS);

    let startHint = '';
    if (isHost && !canStart) {
      startHint = totalPlayers < 2
        ? 'Need at least 2 players (or bots) to start.'
        : 'Waiting for everyone to press READY…';
    }

    this.el.innerHTML = `
      <div class="lobby-panel">
        <h1 class="lobby-title">🐒 LOBBY 🚨</h1>
        <div class="room-code-wrap">
          <span class="room-code-label">Room code — click to copy</span>
          <div class="room-code" role="button" tabindex="0" title="Click to copy">${escapeHTML(roomCode)}</div>
          <span class="copy-feedback">copied! 🍌</span>
        </div>
        <div class="lobby-cols">
          <div class="lobby-box">
            <h2 class="box-title">PLAYERS (${players.length})</h2>
            <ul class="player-list">
              ${players.map((p) => this._playerRowHTML(p, selfId)).join('')}
            </ul>
          </div>
          <div class="lobby-box">
            <h2 class="box-title">SETTINGS</h2>
            <label class="setting-row">
              <span>Mode</span>
              <select class="setting-select" data-setting="mode" ${isHost ? '' : 'disabled'}>
                ${modes
                  .map(
                    (m) =>
                      `<option value="${m.id}" ${m.id === modeId ? 'selected' : ''}>${escapeHTML(m.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label class="setting-row">
              <span>Map</span>
              <select class="setting-select" data-setting="map" ${isHost ? '' : 'disabled'}>
                ${maps
                  .map(
                    (m) =>
                      `<option value="${m.id}" ${m.id === mapId ? 'selected' : ''}>${escapeHTML(m.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label class="setting-row">
              <span>Bot Monkeys</span>
              <select class="setting-select" data-setting="botCount" ${isHost ? '' : 'disabled'}>
                <option value="0" ${data.botCount===0||!data.botCount?'selected':''}>None</option>
                <option value="2" ${data.botCount===2?'selected':''}>2 Monkeys</option>
                <option value="4" ${data.botCount===4?'selected':''}>4 Monkeys</option>
                <option value="6" ${data.botCount===6?'selected':''}>6 Monkeys</option>
                <option value="8" ${data.botCount===8?'selected':''}>8 Monkeys</option>
                <option value="10" ${data.botCount===10?'selected':''}>10 Monkeys</option>
              </select>
            </label>
            <label class="setting-row">
              <span>Bot Diff.</span>
              <select class="setting-select" data-setting="botDifficulty" ${isHost ? '' : 'disabled'}>
                <option value="easy" ${data.botDifficulty==='easy'?'selected':''}>Easy 🟢</option>
                <option value="medium" ${data.botDifficulty==='medium'||!data.botDifficulty?'selected':''}>Medium 🟡</option>
                <option value="hard" ${data.botDifficulty==='hard'?'selected':''}>Hard 🔴</option>
              </select>
            </label>
            <p class="settings-note">${
              isHost ? 'You are the host 👑 — you pick the mode and map.' : 'Only the host 👑 can change settings.'
            }</p>
          </div>
        </div>
        <div class="lobby-actions">
          ${
            isHost
              ? `<button type="button" class="btn btn-big btn-blue" data-action="start" ${canStart ? '' : 'disabled'}>START GAME 🚨</button>`
              : `<button type="button" class="btn btn-big ready-btn ${self && self.ready ? 'is-ready' : ''}" data-action="ready">
                   ${self && self.ready ? 'READY ✅' : 'READY?'}
                 </button>`
          }
          <button type="button" class="btn btn-danger" data-action="leave">LEAVE</button>
        </div>
        ${startHint ? `<p class="start-hint">${startHint}</p>` : ''}
      </div>
    `;

    this._bind(isHost, self);
  }

  _playerRowHTML(p, selfId) {
    const isSelf = p.id === selfId;
    return `
      <li class="player-row ${isSelf ? 'self' : ''}">
        <span class="player-name">
          ${p.isHost ? '👑' : '🐵'} ${escapeHTML(p.name)}
          ${isSelf ? '<span class="you-tag">(you)</span>' : ''}
        </span>
        <span class="player-ready ${p.ready ? 'is-ready' : ''}">
          ${p.isHost ? 'HOST' : p.ready ? '✅ READY' : '… waiting'}
        </span>
      </li>
    `;
  }

  _bind(isHost, self) {
    const codeEl = this.el.querySelector('.room-code');
    const copyCode = () => {
      const code = this.data ? this.data.roomCode : '';
      const done = () => this._showCopied();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, done);
      } else {
        done();
      }
    };
    codeEl.addEventListener('click', copyCode);
    codeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') copyCode();
    });

    for (const select of this.el.querySelectorAll('.setting-select')) {
      select.addEventListener('change', () => {
        if (!isHost) return;
        if (select.dataset.setting === 'mode') {
          this.bus.emit('ui:settings', { modeId: select.value });
        } else if (select.dataset.setting === 'botCount') {
          this.bus.emit('ui:settings', { botCount: parseInt(select.value, 10) });
        } else if (select.dataset.setting === 'botDifficulty') {
          this.bus.emit('ui:settings', { botDifficulty: select.value });
        } else {
          this.bus.emit('ui:settings', { mapId: select.value });
        }
      });
    }

    const readyBtn = this.el.querySelector('[data-action="ready"]');
    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        this.bus.emit('ui:ready', { ready: !(self && self.ready) });
      });
    }

    const startBtn = this.el.querySelector('[data-action="start"]');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.bus.emit('ui:start_game', {}));
    }

    this.el.querySelector('[data-action="leave"]').addEventListener('click', () => {
      this.bus.emit('ui:leave', {});
    });
  }

  _showCopied() {
    const feedback = this.el.querySelector('.copy-feedback');
    if (!feedback) return;
    feedback.classList.add('visible');
    clearTimeout(this._copyTimer);
    this._copyTimer = setTimeout(() => feedback.classList.remove('visible'), 1500);
  }
}
