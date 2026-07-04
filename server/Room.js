// Authoritative room state and round logic for MONKEYALARM!.
// Plain Node ES module: no three.js, no browser APIs. Shares gameplay
// constants with the client via client/core/constants.js.

import { MODES, MAPS, PHASES, ROLES, PLAYER, SCORING } from '../client/core/constants.js';
import { AIBot } from './AIBot.js';
import { MAP_COLLIDERS } from './mapColliders.js';
import { AI_NAMES } from './botConstants.js';

const LOAD_TIMEOUT_MS = 15000;
const MAX_NAME_LENGTH = 16;
// Server-side catch check is lenient vs. the client-side range to absorb latency.
const CATCH_DISTANCE_SQ = (PLAYER.CATCH_RANGE * 1.3) ** 2;

/**
 * Sanitizes a display name: strips control characters, trims, caps at 16
 * chars, falls back to 'Player'.
 * @param {*} raw
 * @returns {string}
 */
export function sanitizeName(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned || 'Player';
}

/**
 * Validates a mode id for online play (solo modes rejected).
 * @param {*} modeId
 * @returns {string} a valid online mode id, CLASSIC as fallback
 */
export function sanitizeModeId(modeId) {
  const mode = typeof modeId === 'string' ? MODES[modeId] : null;
  return mode && !mode.solo ? mode.id : MODES.CLASSIC.id;
}

/**
 * Validates a map id.
 * @param {*} mapId
 * @returns {string} a valid map id, JUNGLE_TEMPLE as fallback
 */
export function sanitizeMapId(mapId) {
  const map = typeof mapId === 'string' ? MAPS[mapId] : null;
  return map ? map.id : MAPS.JUNGLE_TEMPLE.id;
}

/**
 * One multiplayer room: membership (join order preserved), lobby settings,
 * and the full authoritative round state machine.
 */
export class Room {
  /**
   * @param {import('socket.io').Server} io
   * @param {string} code 4-letter room code (also the socket.io room name)
   * @param {{ modeId?: string, mapId?: string }} settings
   */
  constructor(io, code, { modeId, mapId, botCount, botDifficulty } = {}) {
    this.io = io;
    this.code = code;
    this.modeId = sanitizeModeId(modeId);
    this.mapId = sanitizeMapId(mapId);
    /** @type {Map<string, object>} socketId -> member, insertion = join order */
    this.members = new Map();
    this.roundNumber = 0;
    this.phase = PHASES.LOBBY;
    this._awaitingLoad = false;
    this._phaseTimer = null;
    this._loadTimer = null;
    this.botCount = (typeof botCount === 'number' ? Math.min(10, Math.max(0, botCount)) : 0);
    this.botDifficulty = botDifficulty || 'medium';
    this._bots = new Map();
    this._botInterval = null;
  }

  /** @returns {boolean} true when the room has no members */
  get isEmpty() {
    return this.members.size === 0;
  }

  /** @returns {boolean} true once a game has started (room closed to joins) */
  get isLocked() {
    return this.roundNumber > 0;
  }

  /**
   * Adds a socket to the room and emits room_joined / room_updated.
   * @param {import('socket.io').Socket} socket
   * @param {string} name already-sanitized display name
   */
  addMember(socket, name) {
    const member = {
      id: socket.id,
      socket,
      name,
      isHost: this.members.size === 0,
      ready: false,
      role: null,
      caught: false,
      score: 0,
      catches: 0,
      loaded: false,
      lastState: null
    };
    this.members.set(socket.id, member);
    socket.join(this.code);
    socket.emit('room_joined', {
      roomCode: this.code,
      selfId: socket.id,
      players: this._playersInfo(),
      modeId: this.modeId,
      mapId: this.mapId,
      botCount: this.botCount,
      botDifficulty: this.botDifficulty
    });
    this._broadcastRoomUpdated();
  }

  /**
   * Removes a member (leave or disconnect), migrates host, and resolves any
   * mid-round consequences.
   * @param {string} socketId
   */
  removeMember(socketId) {
    const member = this.members.get(socketId);
    if (!member) return;
    this.members.delete(socketId);
    member.socket.leave(this.code);
    this._emitAll('player_left', { id: member.id, name: member.name });

    if (this.isEmpty) {
      this.destroy();
      return;
    }

    if (member.isHost) {
      const next = this.members.values().next().value;
      next.isHost = true;
    }
    this._broadcastRoomUpdated();

    const inRound = this._awaitingLoad ||
      this.phase === PHASES.HIDING || this.phase === PHASES.SEEKING;
    if (!inRound) return;

    const policeLeft = [...this.members.values()]
      .filter((m) => m.role === ROLES.POLICE).length;
    if (policeLeft === 0) {
      this._endRound('monkeys', 'All police left — the monkeys win!');
    } else if (this._remainingMonkeys() === 0) {
      this._endRound('police', 'No monkeys remain — police win!');
    } else if (this._awaitingLoad && this._allLoaded()) {
      this._startPhases();
    }
  }

  /**
   * Marks a member ready/unready and broadcasts the lobby change.
   * @param {string} socketId
   * @param {boolean} ready
   */
  setReady(socketId, ready) {
    const member = this.members.get(socketId);
    if (!member) return;
    member.ready = !!ready;
    this._broadcastRoomUpdated();
  }

  /**
   * Host-only lobby settings change; validated with fallbacks.
   * @param {string} socketId
   * @param {{ modeId?: string, mapId?: string }} settings
   */
  updateSettings(socketId, payload = {}) {
    const { modeId, mapId, botCount, botDifficulty } = payload;
    const member = this.members.get(socketId);
    if (!member) return;
    if (!member.isHost) {
      return this._error(member, 'Only the host can change settings');
    }
    if (this.isLocked) {
      return this._error(member, 'Settings are locked once the game starts');
    }
    if (modeId !== undefined) this.modeId = sanitizeModeId(modeId);
    if (mapId !== undefined) this.mapId = sanitizeMapId(mapId);
    if (botCount !== undefined) this.botCount = Math.min(10, Math.max(0, Number(botCount)||0));
    if (botDifficulty !== undefined) this.botDifficulty = botDifficulty;
    this._broadcastRoomUpdated();
  }

  /**
   * Host-only game start: needs >= 2 players, all non-host members ready.
   * @param {string} socketId
   */
  startGame(socketId) {
    const member = this.members.get(socketId);
    if (!member) return;
    if (!member.isHost) {
      return this._error(member, 'Only the host can start the game');
    }
    if (this.isLocked) {
      return this._error(member, 'Game already in progress');
    }
    if (this.members.size + this.botCount < 2) {
      return this._error(member, 'Need at least 2 players to start');
    }
    const allReady = [...this.members.values()]
      .every((m) => m.isHost || m.ready);
    if (!allReady) {
      return this._error(member, 'All players must be ready');
    }
    this.roundNumber = 1;
    this._beginRound();
  }

  /**
   * Host-only next round (only from round_end; ready checks skipped).
   * @param {string} socketId
   */
  nextRound(socketId) {
    const member = this.members.get(socketId);
    if (!member) return;
    if (!member.isHost) {
      return this._error(member, 'Only the host can start the next round');
    }
    if (this.phase !== PHASES.ROUND_END) {
      return this._error(member, 'No finished round to advance');
    }
    if (this.members.size < 2) {
      return this._error(member, 'Need at least 2 players to start');
    }
    this.roundNumber += 1;
    this._beginRound();
  }

  /**
   * Records that a member finished loading the map; phases begin once
   * everyone has loaded (or the 15 s fallback fires).
   * @param {string} socketId
   */
  notifyLoaded(socketId) {
    const member = this.members.get(socketId);
    if (!member) return;
    member.loaded = true;
    if (this._awaitingLoad && this._allLoaded()) this._startPhases();
  }

  /**
   * Stores a member's last-known state and relays it to the rest of the room
   * as a volatile player_state.
   * @param {string} socketId
   * @param {{ position?: {x:number,y:number,z:number}, yaw?: number, animState?: string }} payload
   */
  handleState(socketId, payload) {
    const member = this.members.get(socketId);
    if (!member || !payload || typeof payload !== 'object') return;
    const p = payload.position;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return;
    member.lastState = {
      position: { x: p.x, y: p.y, z: p.z },
      yaw: Number.isFinite(payload.yaw) ? payload.yaw : 0,
      animState: typeof payload.animState === 'string' ? payload.animState : 'idle'
    };
    member.socket.to(this.code).volatile.emit('player_state', {
      id: member.id,
      position: member.lastState.position,
      yaw: member.lastState.yaw,
      animState: member.lastState.animState
    });
  }

  /**
   * Validates and applies a catch attempt. Invalid attempts are rejected
   * silently.
   * @param {string} socketId catcher
   * @param {string} targetId
   */
  attemptCatch(socketId, targetId) {
    if (this.phase !== PHASES.SEEKING) return;
    const catcher = this.members.get(socketId);
    if (!catcher || catcher.role !== ROLES.POLICE) return;
    const target = this.members.get(targetId) || this._bots.get(targetId);
    if (!target) return;
    if (target.role !== ROLES.MONKEY || target.caught) return;
    const a = catcher.lastState && catcher.lastState.position;
    const b = target.lastState && target.lastState.position;
    if (!a || !b) return;
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    if (dx * dx + dy * dy + dz * dz > CATCH_DISTANCE_SQ) return;

    catcher.score += SCORING.CATCH;
    catcher.catches += 1;
    const infected = !!MODES[this.modeId].infection;
    if (this._bots.has(targetId)) {
      this._bots.get(targetId).caught = true;
    } else if (infected) {
      target.role = ROLES.POLICE; // converted: stays active as a hunter
    } else {
      target.caught = true;
    }
    const remainingMonkeys = this._remainingMonkeys();
    this._emitAll('player_caught', {
      targetId: target.id,
      catcherId: catcher.id,
      infected,
      remainingMonkeys,
      players: this._playersInfo()
    });
    if (remainingMonkeys === 0) {
      this._endRound(
        'police',
        infected ? 'Every monkey joined the force!' : 'All monkeys captured!'
      );
    }
  }

  /** Clears every pending timer; call before deleting the room. */
  destroy() {
    this._clearPhaseTimer();
    this._clearLoadTimer();
    this._stopBotSimulation();
    this._bots.clear();
    this._awaitingLoad = false;
  }

  // ---------------------------------------------------------------- rounds

  _beginRound() {
    this._clearPhaseTimer();
    this._clearLoadTimer();

    const list = [...this.members.values()];
    this._createBots();
    const botsForList = [];
    for (const [id, bot] of this._bots) {
      botsForList.push({ id, name: bot.name, isHost: false, ready: true, role: ROLES.MONKEY, caught: false, score: 0, catches: 0 });
    }
    const allPlayers = [...this.members.values(), ...botsForList];
    const n = list.length;
    const mode = MODES[this.modeId];
    const policeCount = mode.infection ? 1 : Math.max(1, Math.round(n / 4));
    const start = (this.roundNumber - 1) % n;
    const policeIdx = new Set();
    for (let k = 0; k < policeCount; k++) policeIdx.add((start + k) % n);

    const spawns = {};
    let policeSpawn = 0;
    let monkeySpawn = 0;
    list.forEach((m, i) => {
      m.role = policeIdx.has(i) ? ROLES.POLICE : ROLES.MONKEY;
      m.caught = false;
      m.loaded = false;
      m.lastState = null;
      spawns[m.id] = m.role === ROLES.POLICE ? policeSpawn++ : monkeySpawn++;
    });

    this._awaitingLoad = true;
    this._emitAll('game_started', {
      modeId: this.modeId,
      mapId: this.mapId,
      roundNumber: this.roundNumber,
      players: allPlayers,
      spawns
    });
    this._loadTimer = setTimeout(() => this._startPhases(), LOAD_TIMEOUT_MS);
  }

  _allLoaded() {
    return [...this.members.values()].every((m) => m.loaded);
  }

  _startPhases() {
    if (!this._awaitingLoad) return;
    this._awaitingLoad = false;
    this._clearLoadTimer();
    this._startBotSimulation();
    const mode = MODES[this.modeId];
    if (mode.hideSeconds > 0) {
      this._enterPhase(PHASES.HIDING, mode.hideSeconds, () => this._enterSeeking());
    } else {
      this._enterSeeking();
    }
  }

  _enterSeeking() {
    const mode = MODES[this.modeId];
    if (mode.seekSeconds > 0) {
      this._enterPhase(PHASES.SEEKING, mode.seekSeconds, () => this._onSeekExpired());
    } else {
      this._enterPhase(PHASES.SEEKING, null, null);
    }
  }

  _enterPhase(phase, seconds, onExpire) {
    this._clearPhaseTimer();
    this.phase = phase;
    const now = Date.now();
    const endsAt = seconds != null ? now + seconds * 1000 : null;
    this._emitAll('phase_changed', { phase, endsAt, now });
    if (endsAt != null && onExpire) {
      this._phaseTimer = setTimeout(onExpire, seconds * 1000);
    }
  }

  _onSeekExpired() {
    const mode = MODES[this.modeId];
    const survivors = [...this.members.values()]
      .filter((m) => m.role === ROLES.MONKEY && !m.caught);
    for (const m of survivors) m.score += SCORING.SURVIVE;
    let summary = 'Time ran out — the monkeys survived!';
    if (mode.infection) {
      if (survivors.length === 1) {
        survivors[0].score += SCORING.LAST_MONKEY;
        summary = `${survivors[0].name} outlasted the infection!`;
      } else {
        summary = 'The monkeys outlasted the infection!';
      }
    }
    this._endRound('monkeys', summary);
  }

  _endRound(winner, summary) {
    this._clearPhaseTimer();
    this._clearLoadTimer();
    this._stopBotSimulation();
    this._awaitingLoad = false;
    this.phase = PHASES.ROUND_END;
    this._emitAll('phase_changed', {
      phase: PHASES.ROUND_END,
      endsAt: null,
      now: Date.now()
    });
    this._emitAll('round_ended', {
      winner,
      players: this._playersInfo(),
      roundNumber: this.roundNumber,
      summary,
      botCount: this.botCount,
      botDifficulty: this.botDifficulty
    });
  }

  // --------------------------------------------------------------- helpers

  _remainingMonkeys() {
    let count = 0;
    for (const m of this.members.values()) {
      if (m.role === ROLES.MONKEY && !m.caught) count++;
    }
    return count;
  }

  _playersInfo() {
    return [...this.members.values()].map((m) => ({
      id: m.id,
      name: m.name,
      isHost: m.isHost,
      ready: m.ready,
      role: m.role,
      caught: m.caught,
      score: m.score,
      catches: m.catches
    }));
  }

  _broadcastRoomUpdated() {
    this._emitAll('room_updated', {
      players: this._playersInfo(),
      modeId: this.modeId,
      mapId: this.mapId,
      botCount: this.botCount,
      botDifficulty: this.botDifficulty
    });
  }

  _emitAll(event, payload) {
    this.io.to(this.code).emit(event, payload);
  }

  _error(member, message) {
    member.socket.emit('error_msg', { message });
  }

  _clearPhaseTimer() {
    if (this._phaseTimer) {
      clearTimeout(this._phaseTimer);
      this._phaseTimer = null;
    }
  }

  _clearLoadTimer() {
    if (this._loadTimer) {
      clearTimeout(this._loadTimer);
      this._loadTimer = null;
    }
  }

  // ---------------------------------------------------------------- bots

  _createBots() {
    const md = MAP_COLLIDERS[this.mapId];
    if (!md) return;
    this._bots.clear();
    for (let i = 0; i < this.botCount; i++) {
      const botId = 'bot-' + (i + 1);
      const botName = AI_NAMES[i % AI_NAMES.length] + ' (Bot)';
      const sp = md.spawns[i % md.spawns.length];
      this._bots.set(botId, new AIBot({
        id: botId, name: botName, spawn: sp, colliders: [],
        bounds: md.bounds, killY: md.killY, difficulty: this.botDifficulty
      }));
    }
  }

  _startBotSimulation() {
    if (this._bots.size === 0) return;
    this._stopBotSimulation();
    this._botInterval = setInterval(() => {
      if (this.phase !== 'seeking' && this.phase !== 'hiding') return;
      const threats = [];
      for (const m of this.members.values()) {
        if (m.role === 'police' && !m.caught && m.lastState) {
          threats.push({ x: m.lastState.position.x, z: m.lastState.position.z });
        }
      }
      const dt = 1 / 15;
      for (const [id, bot] of this._bots) {
        if (bot.caught) continue;
        bot.setPhase(this.phase);
        bot.update(dt, threats);
        const s = bot.snapshot;
        this.io.to(this.code).volatile.emit('player_state', {
          id, position: s.position, yaw: s.yaw, animState: s.animState
        });
      }
    }, 1000 / 15);
  }

  _stopBotSimulation() { if (this._botInterval) { clearInterval(this._botInterval); this._botInterval = null; } }
}
