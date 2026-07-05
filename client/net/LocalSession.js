// Offline session backend for MONKEYALARM!. Simulates the entire authority
// in-browser (no server, no sockets): one local player (always police/host)
// versus AI monkeys. Implements the same interface and event stream as
// Network so the engine cannot tell the two apart.

import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';
import { MonkeyAI } from '../entities/MonkeyAI.js';
import { EscapeMonkeyAI } from '../entities/EscapeMonkeyAI.js';
import { AI, ESCAPE, MAPS, MODES, PHASES, PLAYER, ROLES, SCORING } from '../core/constants.js';

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
    /** Escape-mode round state (null outside MODES.*.escape rounds). */
    this._escape = null;
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
    // Some modes (e.g. ESCAPE) only play on one specific map.
    if (MODES[this._modeId].fixedMapId) this._mapId = MODES[this._modeId].fixedMapId;
    this._escape = null;
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
    if (MODES[this._modeId].fixedMapId) this._mapId = MODES[this._modeId].fixedMapId;
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
    if (!target || target.role !== ROLES.MONKEY || target.caught || target.escaped) return;
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

    if (this._escape) {
      // Escape: caught carriers drop the keycard, and the police win as soon
      // as too few monkeys remain free for the quota to be reachable.
      if (target.carrying === 'KEYCARD') this._dropKeycard(target, ai);
      const remainingMonkeys =
        this._aiPlayers.filter((m) => !m.caught && !m.escaped).length;
      this._emitAsync('player_caught', {
        targetId,
        catcherId: SELF_ID,
        infected: false,
        remainingMonkeys,
        players: this._playersInfo()
      });
      this._assignEscapeGoals();
      if (remainingMonkeys === 0 ||
          remainingMonkeys + this._escape.escaped < ESCAPE.QUOTA) {
        this._endRound('police', 'Lockdown held — the break-out is crushed! 🚨');
      }
      return;
    }

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
      if (player.caught || player.escaped) continue;
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

    if (this._escape) this._updateEscape(dt);
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
    const escapeMode = !!MODES[this._modeId].escape;
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
    if (escapeMode) {
      this._self.escaped = false;
      this._self.carrying = null;
      this._self.beaconHidden = false;
      for (const player of this._aiPlayers) {
        player.escaped = false;
        player.carrying = null;
        player.beaconHidden = false;
      }
    }

    this._ais.clear();
    const spawnPoints = this._map.monkeySpawns;
    const AiClass = escapeMode ? EscapeMonkeyAI : MonkeyAI;
    this._aiPlayers.forEach((player, i) => {
      const spawn = spawnPoints.length > 0
        ? spawnPoints[i % spawnPoints.length].clone()
        : new THREE.Vector3();
      this._ais.set(player.id, new AiClass({
        id: player.id,
        name: player.name,
        spawn,
        colliders: this._map.colliders,
        bounds: this._map.bounds,
        killY: this._map.killY
      }));
    });

    if (escapeMode) {
      // Escape authority state. Guard all map.escape/map.dynamics access —
      // stub sections may register few (or no) exits/items.
      const mapEscape = this._map.escape;
      this._escape = {
        escaped: 0,
        items: (mapEscape && Array.isArray(mapEscape.items) ? mapEscape.items : [])
          .map((item) => ({ ...item, taken: false, holderId: null })),
        exits: (mapEscape && Array.isArray(mapEscape.exits) ? mapEscape.exits : []).slice(),
        gateOpen: false
      };
      // Reset map dynamics from a possible previous round: re-show every
      // pickup, close the main gate and quiet the alarm until seeking starts.
      for (const item of this._escape.items) {
        this._map.dynamics?.items?.setTaken(item.id, false);
      }
      this._map.dynamics?.items?.setAllVisible(true);
      this._map.dynamics?.mainGate?.close();
      this._map.dynamics?.alarm?.setActive(false);
    } else {
      this._escape = null;
    }

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
    if (this._escape) {
      if (phase === PHASES.SEEKING) this._map?.dynamics?.alarm?.setActive(true);
      // Seeking: send the monkeys for the exits. Hiding: all goals null.
      this._assignEscapeGoals();
    }
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
    if (mode.escape) {
      // Quota not reached in time: the warden held the lockdown. No SURVIVE
      // bonus in Escape — only reaching an exit scores for the monkeys.
      const escaped = this._escape ? this._escape.escaped : 0;
      this._endRound('police', `Lockdown held — only ${escaped} monkey(s) made it out.`);
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

  // ----------------------------------------------------------- escape mode

  /**
   * Per-frame Escape authority: item pickups, the keycard-gated main gate
   * and exit triggers. The steady-state path allocates nothing; payloads are
   * only built when an event actually fires.
   * @param {number} _dt seconds since last frame (durations use _after)
   */
  _updateEscape(_dt) {
    const esc = this._escape;
    const players = this._aiPlayers;

    // (a) Pickups: the first character within reach of an un-taken item
    // takes it (monkeys: KEYCARD/BANANA/SMOKE, police: KEYCARD/COFFEE).
    const pickupSq = ESCAPE.PICKUP_RADIUS * ESCAPE.PICKUP_RADIUS;
    for (let i = 0; i < esc.items.length; i++) {
      const item = esc.items[i];
      if (item.taken) continue;
      let taker = null;
      let takerAi = null;
      if (item.type !== 'COFFEE') {
        for (let j = 0; j < players.length; j++) {
          const player = players[j];
          if (player.caught || player.escaped) continue;
          const ai = this._ais.get(player.id);
          if (!ai) continue;
          const pos = ai.snapshot.position;
          const dx = pos.x - item.x;
          const dy = pos.y - item.y;
          const dz = pos.z - item.z;
          if (dx * dx + dy * dy + dz * dz <= pickupSq) {
            taker = player;
            takerAi = ai;
            break;
          }
        }
      }
      if (!taker && this._selfPos &&
          (item.type === 'COFFEE' || item.type === 'KEYCARD')) {
        const dx = this._selfPos.x - item.x;
        const dy = this._selfPos.y - item.y;
        const dz = this._selfPos.z - item.z;
        if (dx * dx + dy * dy + dz * dz <= pickupSq) taker = this._self;
      }
      if (!taker) continue;

      item.taken = true;
      if (item.type === 'KEYCARD') {
        // A police pickup keeps the keycard forever: the gate never opens.
        item.holderId = taker.id;
        taker.carrying = 'KEYCARD';
      } else if (item.type === 'BANANA') {
        takerAi.setSpeedBoost(ESCAPE.BANANA_SPEED, ESCAPE.BANANA_DURATION);
      } else if (item.type === 'SMOKE') {
        taker.beaconHidden = true;
        const smoked = taker;
        this._after(ESCAPE.SMOKE_DURATION, () => {
          smoked.beaconHidden = false;
          this._emitAsync('escape_progress', {
            kind: 'status',
            byId: smoked.id,
            byName: smoked.name,
            players: this._playersInfo()
          });
        });
      }
      // COFFEE: no session state — Game applies the controller buff.
      this._map.dynamics?.items?.setTaken(item.id, true);
      this._emitAsync('escape_item', {
        kind: 'picked',
        itemId: item.id,
        itemType: item.type,
        byId: taker.id,
        byName: taker.name,
        position: { x: item.x, y: item.y, z: item.z },
        players: this._playersInfo()
      });
      this._assignEscapeGoals();
    }

    // (b) Main gate: a monkey carrying the keycard near the gate opens it.
    if (!esc.gateOpen) {
      let gate = null;
      for (let i = 0; i < esc.exits.length; i++) {
        if (esc.exits[i].id === 'MAIN_GATE') {
          gate = esc.exits[i];
          break;
        }
      }
      if (gate) {
        const trigSq = ESCAPE.GATE_TRIGGER_RADIUS * ESCAPE.GATE_TRIGGER_RADIUS;
        for (let j = 0; j < players.length; j++) {
          const player = players[j];
          if (player.caught || player.escaped || player.carrying !== 'KEYCARD') continue;
          const ai = this._ais.get(player.id);
          if (!ai) continue;
          const pos = ai.snapshot.position;
          const dx = pos.x - gate.x;
          const dz = pos.z - gate.z;
          if (dx * dx + dz * dz > trigSq) continue;
          esc.gateOpen = true;
          this._map.dynamics?.mainGate?.open();
          this._emitAsync('escape_progress', {
            kind: 'gate_opened',
            exitId: gate.id,
            exitName: gate.name,
            byId: player.id,
            byName: player.name,
            players: this._playersInfo()
          });
          this._assignEscapeGoals();
          break;
        }
      }
    }

    // (c) Exits: an un-caught, un-escaped monkey inside an unlocked exit
    // trigger (horizontal radius + y band) escapes.
    for (let j = 0; j < players.length; j++) {
      const player = players[j];
      if (player.caught || player.escaped) continue;
      const ai = this._ais.get(player.id);
      if (!ai) continue;
      const pos = ai.snapshot.position;
      for (let k = 0; k < esc.exits.length; k++) {
        const exit = esc.exits[k];
        if (exit.requiresKeycard && !esc.gateOpen) continue;
        const radius = exit.radius || ESCAPE.EXIT_RADIUS;
        const dx = pos.x - exit.x;
        const dz = pos.z - exit.z;
        if (dx * dx + dz * dz > radius * radius) continue;
        if (Math.abs(pos.y - exit.y) > ESCAPE.EXIT_Y_BAND) continue;
        this._onMonkeyEscaped(player, ai, exit);
        break;
      }
      if (this._phase === PHASES.ROUND_END) return; // quota reached
    }
  }

  /**
   * Recomputes every monkey's goal. Called on phase changes and after every
   * pickup/catch/escape/gate event (never per frame). Outside SEEKING all
   * goals are null so the monkeys scatter.
   */
  _assignEscapeGoals() {
    const esc = this._escape;
    if (!esc) return;
    const scatter = this._phase !== PHASES.SEEKING;

    let keycard = null; // first un-taken keycard on the ground
    let gate = null;    // the keycard-locked main gate exit
    for (let i = 0; i < esc.items.length; i++) {
      const item = esc.items[i];
      if (item.type === 'KEYCARD' && !item.taken) {
        keycard = item;
        break;
      }
    }
    for (let i = 0; i < esc.exits.length; i++) {
      if (esc.exits[i].id === 'MAIN_GATE') {
        gate = esc.exits[i];
        break;
      }
    }

    let runners = 0;
    for (let j = 0; j < this._aiPlayers.length; j++) {
      const player = this._aiPlayers[j];
      const ai = this._ais.get(player.id);
      if (!ai || typeof ai.setGoal !== 'function') continue;
      if (scatter || player.caught || player.escaped) {
        ai.setGoal(null);
        continue;
      }
      if (player.carrying === 'KEYCARD' && gate) {
        ai.setGoal(gate);
        continue;
      }
      if (keycard && !esc.gateOpen && runners < ESCAPE.KEYCARD_RUNNERS) {
        runners += 1;
        ai.setGoal(keycard);
        continue;
      }
      // Everyone else: nearest unlocked exit (null when none — wander).
      const pos = ai.snapshot.position;
      let best = null;
      let bestSq = Infinity;
      for (let k = 0; k < esc.exits.length; k++) {
        const exit = esc.exits[k];
        if (exit.requiresKeycard && !esc.gateOpen) continue;
        const dx = exit.x - pos.x;
        const dz = exit.z - pos.z;
        const d = dx * dx + dz * dz;
        if (d < bestSq) {
          bestSq = d;
          best = exit;
        }
      }
      ai.setGoal(best);
    }
  }

  /** A monkey reached an unlocked exit: score it and check the quota. */
  _onMonkeyEscaped(player, ai, exit) {
    const esc = this._escape;
    player.escaped = true;
    player.score += SCORING.ESCAPE_BONUS;
    esc.escaped += 1;
    if (player.carrying === 'KEYCARD') this._dropKeycard(player, ai);
    const remainingMonkeys =
      this._aiPlayers.filter((m) => !m.caught && !m.escaped).length;
    this._emitAsync('escape_progress', {
      kind: 'escaped',
      exitId: exit.id,
      exitName: exit.name,
      byId: player.id,
      byName: player.name,
      escaped: esc.escaped,
      quota: ESCAPE.QUOTA,
      remainingMonkeys,
      players: this._playersInfo()
    });
    if (esc.escaped >= ESCAPE.QUOTA) {
      this._endRound(
        'monkeys',
        `${esc.escaped} monkeys escaped — the prison break succeeded! 🍌`
      );
      return;
    }
    this._assignEscapeGoals();
  }

  /**
   * Returns a monkey's carried keycard to the ground at its position (used
   * when a carrier is caught, or escapes while still holding it).
   */
  _dropKeycard(player, ai) {
    player.carrying = null;
    const esc = this._escape;
    let item = null;
    for (let i = 0; i < esc.items.length; i++) {
      const candidate = esc.items[i];
      if (candidate.type === 'KEYCARD' && candidate.holderId === player.id) {
        item = candidate;
        break;
      }
    }
    if (!item) return;
    const pos = ai.snapshot.position;
    item.taken = false;
    item.holderId = null;
    item.x = pos.x;
    item.y = pos.y;
    item.z = pos.z;
    this._map.dynamics?.items?.moveTo(item.id, item.x, item.y, item.z);
    this._map.dynamics?.items?.setTaken(item.id, false);
    this._emitAsync('escape_item', {
      kind: 'dropped',
      itemId: item.id,
      itemType: item.type,
      byId: player.id,
      byName: player.name,
      position: { x: item.x, y: item.y, z: item.z },
      players: this._playersInfo()
    });
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
