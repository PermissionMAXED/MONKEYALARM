// Offline session backend for MONKEYALARM!. Simulates the entire authority
// in-browser (no server, no sockets): one local player (always police/host)
// versus AI monkeys. Implements the same interface and event stream as
// Network so the engine cannot tell the two apart.

import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';
import { MonkeyAI } from '../entities/MonkeyAI.js';
import { AI, MAPS, MODES, PHASES, PLAYER, ROLES, SCORING } from '../core/constants.js';

const SELF_ID = 'local-player';
const ROOM_CODE = 'SOLO';
const MAX_NAME_LENGTH = 16;
// Same lenient catch check as the server.
const CATCH_DISTANCE_SQ = (PLAYER.CATCH_RANGE * 1.3) ** 2;

function sanitizeName(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned || 'Player';
}

/** Validates a mode id for offline play (multiplayer-only modes rejected). */
function sanitizeModeId(modeId) {
  const mode = typeof modeId === 'string' ? MODES[modeId] : null;
  return mode && !mode.multiplayerOnly ? mode.id : MODES.CLASSIC.id;
}

function sanitizeMapId(mapId) {
  const map = typeof mapId === 'string' ? MAPS[mapId] : null;
  return map ? map.id : MAPS.JUNGLE_TEMPLE.id;
}

/**
 * Offline implementation of the shared session interface. The local player is
 * always the police host; AI.MONKEY_COUNT MonkeyAI instances play the monkeys.
 */
export class LocalSession {
  constructor() {
    this._bus = new EventBus();
    this._map = null;
    this._modeId = MODES.CLASSIC.id;
    this._mapId = MAPS.JUNGLE_TEMPLE.id;
    this._botCount = 0;
    this._botDifficulty = 'medium';
    this._self = null;
    /** @type {Array<object>} AI PlayerInfo entries, in spawn-index order */
    this._aiPlayers = [];
    /** @type {Map<string, MonkeyAI>} */
    this._ais = new Map();
    this._phase = PHASES.LOBBY;
    this._roundNumber = 0;
    this._awaitingLoad = false;
    this._seekEndsAt = null;
    this._selfPos = null;
    /** @type {Set<ReturnType<typeof setTimeout>>} */
    this._timers = new Set();
    // Scratch objects reused every frame (threats passed to MonkeyAI.update).
    this._threatVec = new THREE.Vector3();
    this._threats = [];
  }

  /** Resolves immediately; there is nothing to connect to. */
  connect() {
    return Promise.resolve();
  }

  /** Stops the simulation and clears all pending timers. */
  disconnect() {
    this._clearTimers();
  }

  /**
   * Creates the solo "room" and emits room_joined asynchronously.
   * @param {{ name?: string, modeId?: string, mapId?: string }} opts
   */
  createRoom({ name, modeId, mapId, botCount, botDifficulty } = {}) {
    this._clearTimers();
    this._modeId = sanitizeModeId(modeId);
    this._mapId = sanitizeMapId(mapId);
    this._botCount = botCount !== undefined ? Math.min(10, Math.max(0, Number(botCount) || 0)) : 4;
    this._botDifficulty = botDifficulty || 'medium';
    this._self = {
      id: SELF_ID,
      name: sanitizeName(name),
      isHost: true,
      ready: true,
      role: null,
      caught: false,
      score: 0,
      catches: 0
    };
    this._aiPlayers = [];
    this._ais.clear();
    this._phase = PHASES.LOBBY;
    this._roundNumber = 0;
    this._awaitingLoad = false;
    this._emitAsync('room_joined', {
      roomCode: ROOM_CODE,
      selfId: SELF_ID,
      players: this._playersInfo(),
      modeId: this._modeId,
      mapId: this._mapId,
      botCount: this._botCount,
      botDifficulty: this._botDifficulty
    });
  }

  /** Not supported offline; emits error_msg. */
  joinRoom(_opts) {
    this._emitAsync('error_msg', { message: 'Joining a room requires online play' });
  }

  /** Leaves the solo room; clears all pending timers. */
  leaveRoom() {
    this._clearTimers();
    this._phase = PHASES.LOBBY;
    this._awaitingLoad = false;
  }

  /** @param {boolean} ready mirrored for interface parity (host is always ready) */
  setReady(ready) {
    if (!this._self) return;
    this._self.ready = !!ready;
    this._emitRoomUpdated();
  }

  /**
   * Changes lobby settings (the local player is always the host).
   * @param {{ modeId?: string, mapId?: string }} opts
   */
  updateSettings({ modeId, mapId, botCount, botDifficulty } = {}) {
    if (modeId !== undefined) this._modeId = sanitizeModeId(modeId);
    if (mapId !== undefined) this._mapId = sanitizeMapId(mapId);
    if (botCount !== undefined) this._botCount = Math.min(10, Math.max(0, Number(botCount)||0));
    if (botDifficulty !== undefined) this._botDifficulty = botDifficulty;
    this._emitRoomUpdated();
  }

  /** Starts the first round. Requires setMap() to have been called. */
  startGame() {
    if (!this._self) {
      this._emitAsync('error_msg', { message: 'Create a room first' });
      return;
    }
    if (!this._map) {
      this._emitAsync('error_msg', { message: 'Map is not ready yet' });
      return;
    }
    if (this._awaitingLoad || this._phase === PHASES.HIDING || this._phase === PHASES.SEEKING) {
      return;
    }
    if (this._roundNumber === 0) this._roundNumber = 1;
    this._beginRound();
  }

  /** Starts the next round: re-rolls AI at fresh spawns. */
  nextRound() {
    if (!this._map || this._roundNumber === 0) return;
    if (this._awaitingLoad || this._phase === PHASES.HIDING || this._phase === PHASES.SEEKING) {
      return;
    }
    this._roundNumber += 1;
    this._beginRound();
  }

  /**
   * Keeps a reference to the built three.js map; its colliders, bounds,
   * killY and spawn lists drive the AI simulation.
   * @param {object} mapInstance
   */
  setMap(mapInstance) {
    this._map = mapInstance;
  }

  /** Map finished loading: run the phase machinery. */
  notifyLoaded() {
    if (!this._awaitingLoad) return;
    this._awaitingLoad = false;
    this._startPhases();
  }

  /**
   * Validates a catch attempt against the AI snapshots (same rules as the
   * server). Ignored in Free Roam.
   * @param {string} targetId
   */
  attemptCatch(targetId) {
    const mode = MODES[this._modeId];
    if (mode.freeRoam || this._phase !== PHASES.SEEKING || !this._self) return;
    const target = this._aiPlayers.find((p) => p.id === targetId);
    if (!target || target.role !== ROLES.MONKEY || target.caught) return;
    const ai = this._ais.get(targetId);
    if (!ai || !this._selfPos) return;
    const p = ai.snapshot.position;
    const dx = this._selfPos.x - p.x;
    const dy = this._selfPos.y - p.y;
    const dz = this._selfPos.z - p.z;
    if (dx * dx + dy * dy + dz * dz > CATCH_DISTANCE_SQ) return;

    this._self.score += SCORING.CATCH;
    this._self.catches += 1;
    target.caught = true;
    ai.setCaught();
    const remainingMonkeys = this._aiPlayers.filter((m) => !m.caught).length;
    this._emitAsync('player_caught', {
      targetId,
      catcherId: SELF_ID,
      infected: false,
      remainingMonkeys,
      players: this._playersInfo()
    });
    if (remainingMonkeys === 0) this._onAllMonkeysCaught();
  }

  /**
   * Advances the AI simulation and emits their player_state events.
   * @param {number} dt seconds since last frame
   * @param {{ position: {x:number,y:number,z:number}, yaw: number, animState: string } | null} selfSnapshot
   */
  update(dt, selfSnapshot) {
    if (selfSnapshot && selfSnapshot.position) this._selfPos = selfSnapshot.position;
    if (this._phase !== PHASES.HIDING && this._phase !== PHASES.SEEKING) return;

    this._threats.length = 0;
    if (this._selfPos) {
      this._threatVec.set(this._selfPos.x, this._selfPos.y, this._selfPos.z);
      this._threats.push(this._threatVec);
    }
    for (const player of this._aiPlayers) {
      if (player.caught) continue;
      const ai = this._ais.get(player.id);
      if (!ai) continue;
      ai.setPhase(this._phase);
      ai.update(dt, this._threats);
      const snap = ai.snapshot;
      // Emitted synchronously: handlers are registered long before the game
      // loop runs, and per-frame state should apply within the same frame.
      this._bus.emit('player_state', {
        id: player.id,
        position: snap.position,
        yaw: snap.yaw,
        animState: snap.animState
      });
    }
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  on(event, handler) {
    return this._bus.on(event, handler);
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this._bus.off(event, handler);
  }

  /** @returns {string} always 'local-player' */
  get selfId() {
    return SELF_ID;
  }

  /** @returns {boolean} always true offline */
  get isHost() {
    return true;
  }

  // ---------------------------------------------------------------- rounds

  _beginRound() {
    this._clearTimers();
    this._self.role = ROLES.POLICE;
    this._self.caught = false;

    if (this._aiPlayers.length === 0) {
      for (let i = 0; i < AI.MONKEY_COUNT; i++) {
        this._aiPlayers.push({
          id: `ai-${i + 1}`,
          name: AI.NAMES[i % AI.NAMES.length],
          isHost: false,
          ready: true,
          role: ROLES.MONKEY,
          caught: false,
          score: 0,
          catches: 0
        });
      }
    } else {
      for (const player of this._aiPlayers) {
        player.role = ROLES.MONKEY;
        player.caught = false;
      }
    }

    this._ais.clear();
    const spawnPoints = this._map.monkeySpawns;
    this._aiPlayers.forEach((player, i) => {
      const spawn = spawnPoints.length > 0
        ? spawnPoints[i % spawnPoints.length].clone()
        : new THREE.Vector3();
      this._ais.set(player.id, new MonkeyAI({
        id: player.id,
        name: player.name,
        spawn,
        colliders: this._map.colliders,
        bounds: this._map.bounds,
        killY: this._map.killY
      }));
    });

    const spawns = { [SELF_ID]: 0 };
    this._aiPlayers.forEach((player, i) => {
      spawns[player.id] = i;
    });

    this._phase = PHASES.LOBBY;
    this._seekEndsAt = null;
    this._awaitingLoad = true;
    this._emitAsync('game_started', {
      modeId: this._modeId,
      mapId: this._mapId,
      roundNumber: this._roundNumber,
      players: this._playersInfo(),
      spawns
    });
  }

  _startPhases() {
    const mode = MODES[this._modeId];
    if (mode.freeRoam) {
      this._setPhase(PHASES.SEEKING, null);
      return;
    }
    if (mode.hideSeconds > 0) {
      this._setPhase(PHASES.HIDING, mode.hideSeconds);
      this._after(mode.hideSeconds, () => this._enterSeeking());
    } else {
      this._enterSeeking();
    }
  }

  _enterSeeking() {
    const mode = MODES[this._modeId];
    if (mode.seekSeconds > 0) {
      this._setPhase(PHASES.SEEKING, mode.seekSeconds);
      this._after(mode.seekSeconds, () => this._onSeekExpired());
    } else {
      this._setPhase(PHASES.SEEKING, null);
    }
  }

  _setPhase(phase, seconds) {
    this._phase = phase;
    const now = Date.now();
    const endsAt = seconds != null ? now + seconds * 1000 : null;
    if (phase === PHASES.SEEKING) this._seekEndsAt = endsAt;
    this._emitAsync('phase_changed', { phase, endsAt, now });
  }

  _onSeekExpired() {
    const mode = MODES[this._modeId];
    if (mode.id === MODES.TIME_ATTACK.id) {
      this._endRound('time', this._timeAttackSummary(0));
      return;
    }
    // CLASSIC solo: monkeys win; AI survivors get the survive bonus for the
    // scoreboard.
    for (const player of this._aiPlayers) {
      if (!player.caught) player.score += SCORING.SURVIVE;
    }
    this._endRound('monkeys', 'Time ran out — the monkeys survived!');
  }

  _onAllMonkeysCaught() {
    const mode = MODES[this._modeId];
    if (mode.id === MODES.TIME_ATTACK.id) {
      const remainingSeconds = this._seekEndsAt != null
        ? Math.max(0, Math.round((this._seekEndsAt - Date.now()) / 1000))
        : 0;
      this._self.score += remainingSeconds * SCORING.TIME_BONUS_PER_SEC;
      this._endRound('time', this._timeAttackSummary(remainingSeconds));
      return;
    }
    this._endRound('police', 'All monkeys captured!');
  }

  _timeAttackSummary(remainingSeconds) {
    const caught = this._aiPlayers.filter((p) => p.caught).length;
    const total = this._aiPlayers.length;
    return `Score: ${this._self.score} — caught ${caught}/${total} with ${remainingSeconds}s left`;
  }

  _endRound(winner, summary) {
    this._clearTimers();
    this._phase = PHASES.ROUND_END;
    this._seekEndsAt = null;
    this._emitAsync('phase_changed', {
      phase: PHASES.ROUND_END,
      endsAt: null,
      now: Date.now()
    });
    this._emitAsync('round_ended', {
      winner,
      players: this._playersInfo(),
      roundNumber: this._roundNumber,
      summary,
      botCount: this._botCount,
      botDifficulty: this._botDifficulty
    });
  }

  // --------------------------------------------------------------- helpers

  _playersInfo() {
    const players = [];
    if (this._self) players.push({ ...this._self });
    for (const player of this._aiPlayers) players.push({ ...player });
    return players;
  }

  _emitRoomUpdated() {
    this._emitAsync('room_updated', {
      players: this._playersInfo(),
      modeId: this._modeId,
      mapId: this._mapId,
      botCount: this._botCount,
      botDifficulty: this._botDifficulty
    });
  }

  /**
   * Emits asynchronously (microtask) so callers that subscribe right after
   * calling a command still receive its response events. FIFO order is
   * preserved across consecutive calls.
   */
  _emitAsync(event, payload) {
    Promise.resolve().then(() => this._bus.emit(event, payload));
  }

  _after(seconds, fn) {
    const handle = setTimeout(() => {
      this._timers.delete(handle);
      fn();
    }, seconds * 1000);
    this._timers.add(handle);
  }

  _clearTimers() {
    for (const handle of this._timers) clearTimeout(handle);
    this._timers.clear();
  }
}
