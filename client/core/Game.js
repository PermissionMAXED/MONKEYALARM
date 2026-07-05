// Central game engine for MONKEYALARM!. Owns the three.js renderer/scene/
// camera, the menu → lobby → loading → playing → round-end state machine,
// session wiring (offline LocalSession or online Network — same interface),
// the local player, remote player avatars, catching, and the frame loop.
// Talks to the UI layer exclusively through the shared event bus.

import * as THREE from 'three';
import { bus } from './EventBus.js';
import { ESCAPE, MAPS, MODES, PHASES, PLAYER, ROLES } from './constants.js';
import { CutscenePlayer } from './Cutscene.js';
import { PlayerController } from '../player/PlayerController.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Network } from '../net/Network.js';
import { LocalSession } from '../net/LocalSession.js';
import AudioManager from '../audio/AudioManager.js';
import { EffectsManager } from '../fx/EffectsManager.js';

/** Engine states. While PLAYING, the finer-grained round phase lives in `_phase`. */
const STATES = {
  MENU: 'menu',
  LOBBY: 'lobby',
  LOADING: 'loading',
  PLAYING: 'playing',
  ROUND_END: 'round_end'
};

const MENU_BACKGROUND = 0x0a0f0a;
const CATCH_COOLDOWN_MS = 400;
const CATCH_CHECK_INTERVAL = 0.1; // seconds between crosshair target checks
const CATCH_AIM_HEIGHT = 0.8;     // aim point above a monkey's feet
const MAX_DT = 0.05;

const FOOTSTEP_INTERVAL_WALK = 0.40;   // seconds between footstep sounds
const FOOTSTEP_INTERVAL_SPRINT = 0.30;
// Reused payloads so the frame loop allocates nothing beyond the timer.
const SFX_FOOTSTEP = { name: 'footstep' };
const SFX_JUMP = { name: 'jump' };
const SFX_LAND = { name: 'land' };
const SFX_CATCH = { name: 'catch' };
const SFX_ALARM = { name: 'alarm' };
const SFX_GATE_OPEN = { name: 'gate_open' };
const SFX_PICKUP = { name: 'pickup' };
const SFX_ESCAPED = { name: 'escaped' };
// Reused game:item payload for clearing the held-item label (frame loop).
const ITEM_CLEAR = { label: null };
// Escape pickup icons for kill-feed lines.
const ITEM_ICONS = { KEYCARD: '🔑', BANANA: '🍌', COFFEE: '☕', SMOKE: '💨' };

/**
 * The game engine. Construct with the render canvas, then call start().
 */
export class Game {
  /**
   * @param {HTMLCanvasElement} canvas the fullscreen render target
   */
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this._menuBackground = new THREE.Color(MENU_BACKGROUND);
    this.scene.background = this._menuBackground;

    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 500
    );

    this._clock = new THREE.Clock();
    this._audioManager = new AudioManager(this.camera);
    this._fx = new EffectsManager(this.scene);
    this._time = 0;

    this._state = STATES.MENU;

    /** @type {LocalSession | Network | null} */
    this._session = null;
    /** @type {Function[]} unsubscribe fns for the current session's events */
    this._sessionUnsubs = [];
    this._solo = false;
    this._roomCode = null;

    /** @type {PlayerController | null} */
    this._controller = null;
    /** @type {import('../maps/MapBase.js').MapBase | null} */
    this._map = null;
    this._mapId = null;
    this._loadToken = 0; // bumped to abort in-flight map loads

    /** @type {Map<string, RemotePlayer>} */
    this._remotePlayers = new Map();
    /** @type {Map<string, object>} latest PlayerInfo by id */
    this._players = new Map();

    this._modeId = null;
    this._selfRole = null;
    this._selfCaught = false;
    this._frozen = false;
    this._phase = null;
    this._endsAt = null; // local-clock ms timestamp, null = no countdown
    this._lastTimerSec = null;
    this._totalMonkeys = 0;

    this._lastCatchAt = 0;
    this._catchAccum = 0;
    this._catchVisible = false;
    this._footstepAccum = 0;

    // Escape mode extras: coffee-buff expiry (performance.now() ms), the
    // persistent held-item HUD label (police keep the keycard for the whole
    // round, so a coffee expiry must not erase it), the last-known escape
    // tallies (fallbacks for partial escape_progress payloads) and the intro
    // cutscene player.
    this._buffUntil = null;
    this._heldItemLabel = null;
    this._escapeCount = 0;
    this._escapeQuota = 0;
    this._escapeRemaining = 0;
    this._cutscene = new CutscenePlayer(this.camera);

    // Scratch objects reused every frame (no per-frame allocation).
    this._forward = new THREE.Vector3();
    this._toTarget = new THREE.Vector3();
    this._snapshot = { position: { x: 0, y: 0, z: 0 }, yaw: 0, animState: 'idle' };

    this._onResize = this._onResize.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onFrame = this._onFrame.bind(this);
  }

  /** Wires UI events, shows the menu and starts the render loop. */
  start() {
    window.addEventListener('resize', this._onResize);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('keydown', this._onKeyDown);
    // Browsers keep the AudioContext suspended until a user gesture; unlock
    // audio on the very first click anywhere.
    window.addEventListener('pointerdown', () => this._audioManager.resume(), { once: true });
    this._onResize();

    bus.on('ui:solo_start', (p) => this._openSession(new LocalSession(), true, (s) => s.createRoom(p)));
    bus.on('ui:host', (p) => this._openSession(new Network(), false, (s) => s.createRoom(p)));
    bus.on('ui:join', (p) => this._openSession(new Network(), false, (s) => s.joinRoom(p)));
    bus.on('ui:ready', ({ ready }) => { if (this._session) this._session.setReady(ready); });
    bus.on('ui:settings', (p) => { if (this._session) this._session.updateSettings(p); });
    bus.on('ui:start_game', () => { if (this._session) this._session.startGame(); });
    bus.on('ui:next_round', () => { if (this._session) this._session.nextRound(); });
    bus.on('ui:leave', () => this._teardown());
    bus.on('ui:resume', () => this._resume());
    bus.on('ui:cutscene_skip', () => this._cutscene.skip());
    bus.on('ui:volume', ({ channel, value }) => {
      this._audioManager.setVolume(channel, value);
    });

    bus.emit('game:menu', {});
    this.renderer.setAnimationLoop(this._onFrame);
  }

  // ------------------------------------------------------------- sessions

  /**
   * Creates a session, connects, then issues the create/join command.
   * @param {LocalSession | Network} session
   * @param {boolean} solo
   * @param {Function} command called with the connected session
   */
  async _openSession(session, solo, command) {
    if (this._session) this._teardown();
    this._session = session;
    this._solo = solo;
    this._subscribeSession(session);
    try {
      await session.connect();
    } catch (err) {
      if (this._session === session) {
        this._teardown({ error: err && err.message ? err.message : 'Connection failed' });
      }
      return;
    }
    if (this._session !== session) return; // torn down while connecting
    command(session);
  }

  /** Subscribes every session event, remembering the unsubscribe functions. */
  _subscribeSession(session) {
    const handlers = {
      room_joined: (p) => this._onRoomJoined(p),
      room_updated: (p) => this._onRoomUpdated(p),
      player_left: (p) => this._onPlayerLeft(p),
      game_started: (p) => this._onGameStarted(p),
      phase_changed: (p) => this._onPhaseChanged(p),
      player_state: (p) => this._onPlayerState(p),
      player_caught: (p) => this._onPlayerCaught(p),
      escape_item: (p) => this._onEscapeItem(p),
      escape_progress: (p) => this._onEscapeProgress(p),
      round_ended: (p) => this._onRoundEnded(p),
      error_msg: (p) => this._onErrorMsg(p),
      disconnected: () => this._teardown({ error: 'Disconnected from server' })
    };
    for (const [event, handler] of Object.entries(handlers)) {
      this._sessionUnsubs.push(session.on(event, handler));
    }
  }

  /**
   * Tears everything down back to the menu. Safe to call from any state.
   * @param {{ error?: string }} [opts] error message shown as a toast
   */
  _teardown({ error } = {}) {
    this._loadToken++; // abort any in-flight map load

    if (this._session) {
      this._session.disconnect();
      for (const unsub of this._sessionUnsubs) unsub();
      this._sessionUnsubs.length = 0;
      this._session = null;
    }

    this._clearRemotePlayers();
    this._removeMap();

    if (this._controller) {
      this._controller.unlock();
      this._controller.dispose();
      this._controller = null;
    }

    // End any running intro cutscene (no-op when inactive). After the
    // controller teardown so its onEnd guard cannot re-show the pause overlay.
    this._cutscene.skip();

    // The AudioManager lives for the whole app lifetime — only silence the
    // map ambient bed here so the next game still has audio.
    this._audioManager.stopAmbient();
    this.scene.fog = null;
    this.scene.background = this._menuBackground;

    this._state = STATES.MENU;
    this._solo = false;
    this._roomCode = null;
    this._players.clear();
    this._modeId = null;
    this._selfRole = null;
    this._selfCaught = false;
    this._frozen = false;
    this._phase = null;
    this._endsAt = null;
    this._lastTimerSec = null;
    this._totalMonkeys = 0;
    this._catchVisible = false;
    this._footstepAccum = 0;
    this._buffUntil = null;
    this._heldItemLabel = null;
    this._escapeCount = 0;
    this._escapeQuota = 0;
    this._escapeRemaining = 0;

    bus.emit('game:menu', error ? { error } : {});
  }

  // ------------------------------------------------------- session events

  _onRoomJoined({ roomCode, selfId, players, modeId, mapId, botCount, botDifficulty }) {
    this._roomCode = roomCode;
    this._updateRoster(players);
    if (this._solo) {
      // Skip the lobby entirely: LocalSession needs the map before
      // startGame() (its AI spawns from the map's spawn lists).
      this._beginSolo(mapId);
      return;
    }
    this._state = STATES.LOBBY;
    bus.emit('game:lobby', { roomCode, selfId, players, modeId, mapId, botCount, botDifficulty });
  }

  _onRoomUpdated({ players, modeId, mapId, botCount, botDifficulty }) {
    this._updateRoster(players);
    if (this._state !== STATES.LOBBY || !this._session) return;
    bus.emit('game:lobby', {
      roomCode: this._roomCode,
      selfId: this._session.selfId,
      players,
      modeId,
      mapId,
      botCount,
      botDifficulty
    });
  }

  /** Solo bootstrap: preload the map, hand it to the session, start round 1. */
  async _beginSolo(mapId) {
    const session = this._session;
    let map = null;
    try {
      map = await this._loadMap(mapId);
    } catch (err) {
      console.error('Map load failed:', err);
    }
    if (this._session !== session) return;
    if (!map) {
      this._teardown({ error: 'Failed to load map' });
      return;
    }
    session.setMap(map);
    session.startGame();
  }

  async _onGameStarted(payload) {
    const session = this._session;
    this._updateRoster(payload.players);
    this._modeId = payload.modeId;
    this._state = STATES.LOADING;
    this._phase = null;
    this._endsAt = null;
    this._lastTimerSec = null;
    this._selfCaught = false;
    this._lastCatchAt = 0;
    this._catchVisible = false;

    // Clear escape leftovers from a previous round: end any still-running
    // intro cutscene and drop the coffee buff + held-item label.
    this._cutscene.skip();
    this._buffUntil = null;
    this._heldItemLabel = null;
    if (this._controller) this._controller.setSpeedMultiplier(1);

    let map = null;
    try {
      map = await this._loadMap(payload.mapId);
    } catch (err) {
      console.error('Map load failed:', err);
    }
    if (this._session !== session) return;
    if (!map) {
      this._teardown({ error: 'Failed to load map' });
      return;
    }
    session.setMap(map);

    const selfId = session.selfId;
    const selfInfo = this._players.get(selfId);
    this._selfRole = selfInfo && selfInfo.role ? selfInfo.role : ROLES.POLICE;

    if (!this._controller) {
      this._controller = new PlayerController(this.camera, this.canvas, {
        onLock: () => bus.emit('game:pause', { visible: false }),
        onUnlock: () => {
          if (this._state === STATES.PLAYING) {
            bus.emit('game:pause', { visible: true, text: 'Paused' });
          }
        }
      });
    }
    this._controller.setRole(this._selfRole);
    this._controller.setWorld({ colliders: map.colliders, killY: map.killY });
    this._controller.spawnAt(this._resolveSpawn(this._selfRole, payload.spawns[selfId] ?? 0));

    this._clearRemotePlayers();
    for (const info of payload.players) {
      if (info.id === selfId) continue;
      const remote = new RemotePlayer({ id: info.id, name: info.name, role: info.role });
      const spawn = this._resolveSpawn(info.role, payload.spawns[info.id] ?? 0);
      remote.applyState({
        position: { x: spawn.x, y: spawn.y, z: spawn.z },
        yaw: 0,
        animState: 'idle'
      });
      this.scene.add(remote.group);
      this._remotePlayers.set(info.id, remote);
    }

    this._totalMonkeys = payload.players.filter((p) => p.role === ROLES.MONKEY).length;
    this._state = STATES.PLAYING;
    this._footstepAccum = 0;
    this._updateFreeze();
    this._updateBeacons();

    bus.emit('game:hud', {
      role: this._selfRole,
      modeId: this._modeId,
      mapId: this._mapId,
      mapName: map.name,
      roomCode: this._solo ? null : this._roomCode
    });
    bus.emit('game:monkeys', { remaining: this._totalMonkeys, total: this._totalMonkeys });

    const escapeMode = Boolean(MODES[this._modeId]?.escape);
    if (escapeMode) {
      this._escapeCount = 0;
      this._escapeQuota = ESCAPE.QUOTA;
      this._escapeRemaining = this._totalMonkeys;
      bus.emit('game:escape', {
        escaped: 0,
        quota: ESCAPE.QUOTA,
        remaining: this._totalMonkeys
      });
    }

    // A phase_changed may have arrived while the map was loading.
    if (this._phase) {
      bus.emit('game:phase', { phase: this._phase, remainingSec: this._remainingSec() });
    }

    session.notifyLoaded();

    const intro = escapeMode && this._map.escape ? this._map.escape.intro : null;
    if (intro) {
      // Escape intro fly-through: the cutscene owns the camera and the
      // "click to enter" pause overlay is suppressed until it ends. The
      // session's phase timers keep running independently, so a soft-lock is
      // impossible: the script clock is clamped and skippable at any moment.
      bus.emit('game:cutscene:start', {});
      this._cutscene.start(intro, {
        onSub: (text) => bus.emit('game:cutscene:sub', { text }),
        onEnd: () => {
          bus.emit('game:cutscene:end', {});
          if (this._state === STATES.PLAYING && this._controller && !this._controller.isLocked) {
            bus.emit('game:pause', { visible: true, text: 'Click to enter the hunt' });
          }
        }
      });
    } else if (!this._controller.isLocked) {
      bus.emit('game:pause', { visible: true, text: 'Click to enter the hunt' });
    }
  }

  _onPhaseChanged({ phase, endsAt, now }) {
    this._phase = phase;
    // Convert the sender's clock to the local clock, then count down locally.
    this._endsAt = endsAt != null ? Date.now() + (endsAt - now) : null;
    const remainingSec = this._remainingSec();
    this._lastTimerSec = remainingSec;
    bus.emit('game:phase', { phase, remainingSec });

    if (phase === PHASES.HIDING) {
      if (this._selfRole === ROLES.POLICE) {
        bus.emit('game:banner', { text: 'The monkeys are hiding… 🙈', sticky: true });
      } else {
        bus.emit('game:banner', { text: 'HIDE! The police are coming!' });
      }
    } else if (phase === PHASES.SEEKING) {
      bus.emit('game:banner', { text: 'GO! 🚨' });
      bus.emit('game:flash', { kind: 'go' });
      if (MODES[this._modeId]?.escape) bus.emit('game:sfx', SFX_ALARM);
    }

    this._updateFreeze();
    this._updateBeacons();
  }

  _onPlayerState(payload) {
    const remote = this._remotePlayers.get(payload.id);
    if (remote) remote.applyState(payload);
  }

  _onPlayerCaught({ targetId, catcherId, infected, remainingMonkeys, players }) {
    this._updateRoster(players);
    const selfId = this._session ? this._session.selfId : null;

    if (targetId === selfId) {
      if (infected) {
        this._selfRole = ROLES.POLICE;
        if (this._controller) this._controller.setRole(ROLES.POLICE);
        bus.emit('game:hud', {
          role: ROLES.POLICE,
          modeId: this._modeId,
          mapId: this._mapId,
          mapName: this._map ? this._map.name : '',
          roomCode: this._solo ? null : this._roomCode
        });
        bus.emit('game:banner', { text: "You've been recruited! 🚨" });
      } else {
        this._selfCaught = true;
        bus.emit('game:sfx', { name: 'caught_self' });
        bus.emit('game:banner', { text: 'CAUGHT!', sticky: true });
        bus.emit('game:flash', { kind: 'caught' });
      }
      this._updateFreeze();
    } else {
      const remote = this._remotePlayers.get(targetId);
      if (remote) {
        this._fx.spawnCatchBurst(remote.position);
        if (infected) remote.setRole(ROLES.POLICE);
        else remote.setCaught(true);
      }
    }

    if (catcherId === selfId) bus.emit('game:flash', { kind: 'catch' });
    // Catch confirmation chime — except when the local player was the one
    // caught (that branch plays the 'caught_self' defeat sting instead).
    if (targetId !== selfId || infected) bus.emit('game:sfx', SFX_CATCH);
    this._updateBeacons();

    const catcher = this._players.get(catcherId);
    const target = this._players.get(targetId);
    bus.emit('game:feed', {
      text: `👮 ${catcher ? catcher.name : 'Someone'} caught 🐒 ${target ? target.name : 'a monkey'}`
    });
    bus.emit('game:monkeys', { remaining: remainingMonkeys, total: this._totalMonkeys });
  }

  /** Escape mode: an item was picked up, dropped or expired. */
  _onEscapeItem(p) {
    this._updateRoster(p.players);
    const icon = ITEM_ICONS[p.itemType] || '✨';
    if (p.kind === 'picked') {
      bus.emit('game:sfx', SFX_PICKUP);
      bus.emit('game:feed', { text: `${icon} ${p.byName} grabbed the ${p.itemType}!` });
    } else if (p.kind === 'dropped') {
      bus.emit('game:feed', { text: `${icon} ${p.byName} dropped the ${p.itemType}!` });
    } else if (p.kind === 'expired') {
      bus.emit('game:feed', { text: `${icon} The ${p.itemType} expired` });
    }

    if (p.kind === 'picked' && this._session && p.byId === this._session.selfId) {
      if (p.itemType === 'COFFEE') {
        if (this._controller) this._controller.setSpeedMultiplier(ESCAPE.COFFEE_MULT);
        this._buffUntil = performance.now() + ESCAPE.COFFEE_DURATION * 1000;
        bus.emit('game:item', { label: '☕ SPEED BOOST' });
      } else if (p.itemType === 'KEYCARD') {
        this._heldItemLabel = '🔑 KEYCARD SECURED';
        bus.emit('game:item', { label: this._heldItemLabel });
      }
    }
    this._updateBeacons();
  }

  /** Escape mode: the gate opened, a monkey escaped, or roster status changed. */
  _onEscapeProgress(p) {
    this._updateRoster(p.players);

    if (p.kind === 'gate_opened') {
      bus.emit('game:banner', { text: 'THE MAIN GATE IS OPEN! 🚪' });
      bus.emit('game:sfx', SFX_GATE_OPEN);
    } else if (p.kind === 'escaped') {
      // The escapee is gone for good: remove its avatar like a leaver.
      const remote = this._remotePlayers.get(p.byId);
      if (remote) {
        this.scene.remove(remote.group);
        remote.dispose();
        this._remotePlayers.delete(p.byId);
      }
      bus.emit('game:flash', { kind: 'caught' });
      bus.emit('game:sfx', SFX_ESCAPED);
      bus.emit('game:feed', { text: `🏃 ${p.byName} ESCAPED via ${p.exitName}!` });
    }

    // Some kinds (e.g. 'status') omit the tallies — fall back to last known.
    if (typeof p.escaped === 'number') this._escapeCount = p.escaped;
    if (typeof p.quota === 'number') this._escapeQuota = p.quota;
    if (typeof p.remainingMonkeys === 'number') this._escapeRemaining = p.remainingMonkeys;
    bus.emit('game:escape', {
      escaped: this._escapeCount,
      quota: this._escapeQuota,
      remaining: this._escapeRemaining
    });
    this._updateBeacons();
  }

  _onRoundEnded(payload) {
    this._updateRoster(payload.players);
    this._state = STATES.ROUND_END;
    this._phase = PHASES.ROUND_END;
    this._endsAt = null;
    this._updateFreeze();
    this._setCatchVisible(false);
    if (this._controller) this._controller.unlock();

    let winnerText;
    if (payload.winner === 'police') winnerText = 'POLICE WIN! 🚨';
    else if (payload.winner === 'monkeys') winnerText = 'MONKEYS WIN! 🍌';
    else winnerText = payload.summary || 'TIME!';

    // Time Attack ends with winner 'time' — a win only if every monkey was
    // caught; if the timer expired with monkeys still free, it's a loss.
    const allMonkeysCaught = !payload.players.some(
      (p) => p.role === ROLES.MONKEY && !p.caught
    );
    const selfWon =
      (payload.winner === 'police' && this._selfRole === ROLES.POLICE) ||
      (payload.winner === 'monkeys' && this._selfRole === ROLES.MONKEY) ||
      (payload.winner === 'time' && allMonkeysCaught);
    bus.emit('game:sfx', { name: selfWon ? 'round_win' : 'round_lose' });

    bus.emit('game:roundend', {
      winnerText,
      players: payload.players,
      selfId: this._session ? this._session.selfId : null,
      canNextRound: this._session ? this._session.isHost : false,
      botCount: payload.botCount ?? 0,
      botDifficulty: payload.botDifficulty || 'medium'
    });
  }

  _onPlayerLeft({ id, name }) {
    this._players.delete(id);
    const remote = this._remotePlayers.get(id);
    if (remote) {
      this.scene.remove(remote.group);
      remote.dispose();
      this._remotePlayers.delete(id);
      bus.emit('game:feed', { text: `🚪 ${name} left the game` });
    }
  }

  _onErrorMsg({ message }) {
    if (this._state === STATES.MENU) {
      // Failed to create/join a room: back to menu with the reason.
      this._teardown({ error: message });
    } else {
      bus.emit('game:toast', { message });
    }
  }

  // ------------------------------------------------------------ map & world

  /**
   * Loads (or reuses) the map for a round: same map id → no reload flash.
   * Returns null if the load was superseded by teardown or a newer load.
   * @param {string} mapId
   * @returns {Promise<import('../maps/MapBase.js').MapBase | null>}
   */
  async _loadMap(mapId) {
    if (this._map && this._mapId === mapId) return this._map;
    const entry = MAPS[mapId];
    if (!entry) return null;
    const token = ++this._loadToken;
    bus.emit('game:loading', { mapName: entry.name });
    const mod = await entry.load();
    if (token !== this._loadToken) return null;
    this._removeMap();
    const map = new mod.default();
    map.build();
    this.scene.add(map.group);
    this._applyEnvironment(map.environment);
    this._map = map;
    this._mapId = mapId;
    return map;
  }

  _applyEnvironment(environment) {
    this.scene.background = new THREE.Color(environment.skyColor);
    this.scene.fog = environment.fog
      ? new THREE.Fog(environment.fog.color, environment.fog.near, environment.fog.far)
      : null;
  }

  _removeMap() {
    if (!this._map) return;
    this.scene.remove(this._map.group);
    this._map.dispose();
    this._map = null;
    this._mapId = null;
  }

  /**
   * Resolves a spawn index to a FEET position on the current map.
   * @param {'police'|'monkey'} role
   * @param {number} index
   * @returns {THREE.Vector3}
   */
  _resolveSpawn(role, index) {
    const list = role === ROLES.POLICE ? this._map.policeSpawns : this._map.monkeySpawns;
    if (!list || list.length === 0) return new THREE.Vector3();
    return list[index % list.length].clone();
  }

  _clearRemotePlayers() {
    for (const remote of this._remotePlayers.values()) {
      this.scene.remove(remote.group);
      remote.dispose();
    }
    this._remotePlayers.clear();
  }

  _updateRoster(players) {
    if (!Array.isArray(players)) return;
    this._players.clear();
    for (const info of players) this._players.set(info.id, info);
  }



  // ------------------------------------------------------- gameplay helpers

  /**
   * Shows the through-wall alarm beacon over each un-caught monkey, but only
   * for police during the seeking phase.
   */
  _updateBeacons() {
    const show =
      this._selfRole === ROLES.POLICE && this._phase === PHASES.SEEKING;
    for (const remote of this._remotePlayers.values()) {
      const info = this._players.get(remote.id);
      remote.setBeaconVisible(
        show && Boolean(info) && info.role === ROLES.MONKEY && !info.caught &&
        !info.beaconHidden // smoke bomb (Escape mode)
      );
    }
  }

  /** Applies the freeze rules to the local controller. */
  _updateFreeze() {
    this._frozen =
      this._state !== STATES.PLAYING ||
      this._selfCaught ||
      this._phase === PHASES.ROUND_END ||
      (this._phase === PHASES.HIDING && this._selfRole === ROLES.POLICE);
    if (this._controller) this._controller.setFrozen(this._frozen);
  }

  /** @returns {number | null} whole seconds left in the current phase */
  _remainingSec() {
    return this._endsAt != null
      ? Math.max(0, Math.ceil((this._endsAt - Date.now()) / 1000))
      : null;
  }

  /** Handles ui:resume synchronously so pointer lock keeps the user gesture. */
  _resume() {
    this._audioManager.resume(); // the context can re-suspend after tab switches
    bus.emit('game:pause', { visible: false });
    if (this._controller && this._state === STATES.PLAYING) this._controller.lock();
  }

  // ---------------------------------------------------------------- catching

  _canAttemptCatch() {
    return this._state === STATES.PLAYING &&
      this._phase === PHASES.SEEKING &&
      this._selfRole === ROLES.POLICE &&
      !this._selfCaught &&
      this._controller !== null &&
      this._controller.isLocked;
  }

  /**
   * Finds the nearest un-caught monkey within catch range and view cone.
   * @returns {string | null} target player id
   */
  _findCatchTarget() {
    this.camera.getWorldDirection(this._forward);
    let bestId = null;
    let bestDist = Infinity;
    for (const remote of this._remotePlayers.values()) {
      const info = this._players.get(remote.id);
      if (!info || info.role !== ROLES.MONKEY || info.caught) continue;
      this._toTarget.copy(remote.position);
      this._toTarget.y += CATCH_AIM_HEIGHT;
      this._toTarget.sub(this.camera.position);
      const dist = this._toTarget.length();
      if (dist > PLAYER.CATCH_RANGE || dist >= bestDist) continue;
      if (dist > 0.001) {
        this._toTarget.multiplyScalar(1 / dist);
        if (this._toTarget.dot(this._forward) < PLAYER.CATCH_FOV_DOT) continue;
      }
      bestDist = dist;
      bestId = remote.id;
    }
    return bestId;
  }

  _onMouseDown(event) {
    if (event.button !== 0 || !this._canAttemptCatch()) return;
    const now = performance.now();
    if (now - this._lastCatchAt < CATCH_COOLDOWN_MS) return;
    this._lastCatchAt = now;
    const targetId = this._findCatchTarget();
    if (targetId) this._session.attemptCatch(targetId);
  }

  _setCatchVisible(visible) {
    if (visible === this._catchVisible) return;
    this._catchVisible = visible;
    bus.emit('game:catch_target', { visible });
  }

  /** Space/Enter/Escape skip the intro cutscene; inert at any other time. */
  _onKeyDown(event) {
    if (!this._cutscene.isActive) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'Escape') {
      this._cutscene.skip();
    }
  }

  // -------------------------------------------------------------- frame loop

  _onFrame() {
    const dt = Math.min(this._clock.getDelta(), MAX_DT);
    this._time += dt;

    const cutsceneActive = this._cutscene.isActive;

    // Consume the jump/land edges unconditionally every frame so landings
    // that happen while unlocked/frozen (spawn, pause, blindfold) never fire
    // as stale SFX/dust on the next pointer-lock.
    let justJumped = false;
    let justLanded = false;
    if (this._controller) {
      // While the intro cutscene owns the camera the controller is skipped;
      // its next update() re-copies the camera from the resting feet position.
      if (!cutsceneActive) this._controller.update(dt);
      justJumped = this._controller.consumeJustJumped();
      justLanded = this._controller.consumeJustLanded();
    }

    if (this._session) {
      let snapshot = null;
      if (this._state === STATES.PLAYING && this._controller) {
        const pos = this._controller.position;
        snapshot = this._snapshot;
        snapshot.position.x = pos.x;
        snapshot.position.y = pos.y;
        snapshot.position.z = pos.z;
        snapshot.yaw = this._controller.yaw;
        snapshot.animState = (this._frozen || this._selfCaught)
          ? 'idle'
          : (this._controller.isMoving ? 'run' : 'idle');
      }
      this._session.update(dt, snapshot);
    }

    for (const remote of this._remotePlayers.values()) remote.update(dt, this.camera.position);
    if (this._map) this._map.update(dt, this._time);
    this._fx.update(dt);
    if (cutsceneActive) this._cutscene.update(dt);

    if (this._state === STATES.PLAYING) {
      // Coffee buff expiry (Escape mode); _buffUntil is null everywhere else.
      if (this._buffUntil !== null && performance.now() > this._buffUntil) {
        this._buffUntil = null;
        if (this._controller) this._controller.setSpeedMultiplier(1);
        // Fall back to the persistent held-item label (Escape: a secured
        // keycard) instead of always blanking the HUD slot.
        bus.emit('game:item', this._heldItemLabel ? { label: this._heldItemLabel } : ITEM_CLEAR);
      }
      const sec = this._remainingSec();
      if (sec !== null && sec !== this._lastTimerSec) {
        this._lastTimerSec = sec;
        bus.emit('game:timer', { remainingSec: sec });
      }
      if (this._controller && this._controller.isLocked && !this._frozen) {
        if (justJumped) bus.emit('game:sfx', SFX_JUMP);
        if (justLanded) {
          // Landing dust shares the land-SFX edge, so it never fires on
          // spawn/respawn (unlocked) or while frozen.
          bus.emit('game:sfx', SFX_LAND);
          this._fx.spawnDustPuff(this._controller.position);
        }
        if (this._controller.isMoving && this._controller.onGround) {
          this._footstepAccum += dt;
          const interval = this._controller.isSprinting
            ? FOOTSTEP_INTERVAL_SPRINT
            : FOOTSTEP_INTERVAL_WALK;
          if (this._footstepAccum >= interval) {
            this._footstepAccum -= interval;
            bus.emit('game:sfx', SFX_FOOTSTEP);
          }
        } else {
          this._footstepAccum = 0;
        }
      }
      this._catchAccum += dt;
      if (this._catchAccum >= CATCH_CHECK_INTERVAL) {
        this._catchAccum %= CATCH_CHECK_INTERVAL;
        this._setCatchVisible(this._canAttemptCatch() && this._findCatchTarget() !== null);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
