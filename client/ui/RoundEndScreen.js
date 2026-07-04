// Round-end screen: winner banner, sorted score table, next-round / back to
// menu actions, and a lightweight CSS confetti shower.

import { ROLES } from '../core/constants.js';

const CONFETTI_COLORS = ['#ffd24a', '#1d4ed8', '#dc2626', '#22c55e', '#f5f2e8'];
const CONFETTI_COUNT = 36;

function escapeHTML(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Round-end results screen. Emits `ui:next_round` and `ui:leave`.
 */
export class RoundEndScreen {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.el = document.createElement('div');
    this.el.className = 'screen roundend-screen';
    this.el.hidden = true;
  }

  /**
   * Shows results for the finished round.
   * @param {{winnerText: string, players: Array<object>, selfId: string, canNextRound: boolean}} data
   */
  show(data) {
    this._render(data);
    this.el.hidden = false;
  }

  /** Hides the screen. */
  hide() {
    this.el.hidden = true;
  }

  /**
   * Routes screen-level updates while visible.
   * @param {string} event
   * @param {*} payload
   */
  update(event, payload) {
    if (event === 'game:roundend') this._render(payload);
  }

  _render({ winnerText, players, selfId, canNextRound, botCount = 0, botDifficulty }) {
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    this.el.innerHTML = `
      <div class="confetti">${this._confettiHTML()}</div>
      <div class="roundend-panel">
        <h1 class="winner-banner">${escapeHTML(winnerText)}</h1>
        <table class="score-table">
          <thead>
            <tr>
              <th>#</th><th>PLAYER</th><th>ROLE</th><th>CATCHES</th><th>SCORE</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((p, i) => this._rowHTML(p, i + 1, selfId)).join('')}
          </tbody>
        </table>
        ${botCount > 0 ? '<p class="game-info">🤖 ' + botCount + ' Bot(s) · ' + (botDifficulty || 'Medium') + ' difficulty</p>' : ''}
        <div class="roundend-actions">
          ${canNextRound ? '<button type="button" class="btn btn-big btn-blue" data-action="next">NEXT ROUND 🍌</button>' : ''}
          <button type="button" class="btn" data-action="menu">BACK TO MENU</button>
        </div>
      </div>
    `;

    const nextBtn = this.el.querySelector('[data-action="next"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.bus.emit('ui:next_round', {}));
    }
    this.el.querySelector('[data-action="menu"]').addEventListener('click', () => {
      this.bus.emit('ui:leave', {});
    });
  }

  _rowHTML(p, rank, selfId) {
    const roleEmoji = p.role === ROLES.POLICE ? '👮' : p.role === ROLES.MONKEY ? '🐒' : '❔';
    return `
      <tr class="${p.id === selfId ? 'self-row' : ''}">
        <td class="rank">${rank}</td>
        <td>${escapeHTML(p.name)}${p.id === selfId ? ' <span class="you-tag">(you)</span>' : ''}</td>
        <td>${roleEmoji}</td>
        <td>${p.catches ?? 0}</td>
        <td class="score">${p.score ?? 0}</td>
        <td>${p.caught ? '<span class="caught-tag">CAUGHT</span>' : ''}</td>
      </tr>
    `;
  }

  _confettiHTML() {
    let html = '';
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const left = (i * 37 + 11) % 100;
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const duration = 3 + ((i * 13) % 30) / 10;
      const delay = -((i * 7) % 40) / 10;
      const width = 6 + (i % 3) * 3;
      const height = 10 + ((i * 5) % 3) * 4;
      html +=
        `<span class="confetti-piece" style="left:${left}%;background:${color};` +
        `width:${width}px;height:${height}px;` +
        `animation-duration:${duration.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"></span>`;
    }
    return html;
  }
}
