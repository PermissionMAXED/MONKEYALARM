// Online session backend for MONKEYALARM!. A thin translator between the
// engine-facing session interface and the socket.io wire protocol: it relays
// server events to its own emitter, tracks selfId/isHost, and forwards method
// calls as socket messages. All game authority lives on the server.

import { io } from 'socket.io-client';
import { EventBus } from '../core/EventBus.js';
import { NET } from '../core/constants.js';

/** Server events relayed verbatim to the engine. */
const SERVER_EVENTS = [
  'room_joined',
  'room_updated',
  'player_left',
  'game_started',
  'phase_changed',
  'player_state',
  'player_caught',
  'round_ended',
  'error_msg'
];

const CONNECT_TIMEOUT_MS = 4000;
const CONNECT_FAIL_MESSAGE = 'Server unreachable — start it with: npm run server';
const SEND_INTERVAL = 1 / NET.SEND_HZ; // seconds between outgoing state packets

/**
 * Online session implementation of the shared session interface.
 * Connects same-origin with io() defaults (Vite proxies /socket.io).
 */
export class Network {
  constructor() {
    this._bus = new EventBus();
    this._socket = null;
    this._selfId = null;
    this._isHost = false;
    // Primed so the first update() with a snapshot sends immediately.
    this._sendAccum = SEND_INTERVAL;
  }

  /**
   * Opens the socket. Resolves on 'connect'; rejects on 'connect_error' or
   * after a 4 s timeout with a "server unreachable" message.
   * @returns {Promise<void>}
   */
  connect() {
    if (this._socket && this._socket.connected) return Promise.resolve();
    if (this._socket) this.disconnect();

    return new Promise((resolve, reject) => {
      const socket = io();
      this._socket = socket;
      let settled = false;

      const onConnect = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.off('connect_error', onFail);
        resolve();
      };
      const onFail = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._teardown();
        reject(new Error(CONNECT_FAIL_MESSAGE));
      };
      const timer = setTimeout(onFail, CONNECT_TIMEOUT_MS);

      this._bind(socket);
      socket.once('connect', onConnect);
      socket.once('connect_error', onFail);
    });
  }

  /** Closes the socket and resets local session state. */
  disconnect() {
    this._teardown();
  }

  /** @param {{ name?: string, modeId?: string, mapId?: string }} opts */
  createRoom({ name, modeId, mapId } = {}) {
    this._send('create_room', { name, modeId, mapId });
  }

  /** @param {{ name?: string, roomCode?: string }} opts */
  joinRoom({ name, roomCode } = {}) {
    this._send('join_room', { name, roomCode });
  }

  /** Leaves the current room. */
  leaveRoom() {
    this._send('leave_room', {});
    this._selfId = null;
    this._isHost = false;
  }

  /** @param {boolean} ready */
  setReady(ready) {
    this._send('set_ready', { ready: !!ready });
  }

  /** Host only. @param {{ modeId?: string, mapId?: string, botCount?: number, botDifficulty?: string }} opts */
  updateSettings({ modeId, mapId, botCount, botDifficulty } = {}) {
    this._send('update_settings', { modeId, mapId, botCount, botDifficulty });
  }

  /** Host only: asks the server to start the game. */
  startGame() {
    this._send('start_game', {});
  }

  /** Host only: asks the server to start the next round. */
  nextRound() {
    this._send('next_round', {});
  }

  /** No-op online; the server never needs the three.js map. */
  setMap(_mapInstance) {}

  /** Tells the server this client finished loading the map. */
  notifyLoaded() {
    this._send('loaded', {});
  }

  /** @param {string} targetId */
  attemptCatch(targetId) {
    this._send('catch', { targetId });
  }

  /**
   * Sends the local player's state, throttled to NET.SEND_HZ. Nothing is sent
   * when no snapshot is given.
   * @param {number} dt seconds since last frame
   * @param {{ position: {x:number,y:number,z:number}, yaw: number, animState: string } | null} selfSnapshot
   */
  update(dt, selfSnapshot) {
    if (!selfSnapshot || !this._socket || !this._socket.connected) return;
    this._sendAccum += dt;
    if (this._sendAccum < SEND_INTERVAL) return;
    this._sendAccum %= SEND_INTERVAL;
    this._socket.volatile.emit('state', {
      position: selfSnapshot.position,
      yaw: selfSnapshot.yaw,
      animState: selfSnapshot.animState
    });
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

  /** @returns {string | null} own player id, known after room_joined */
  get selfId() {
    return this._selfId;
  }

  /** @returns {boolean} whether this client is the room host */
  get isHost() {
    return this._isHost;
  }

  _bind(socket) {
    for (const event of SERVER_EVENTS) {
      socket.on(event, (payload) => this._relay(event, payload));
    }
    socket.on('disconnect', (reason) => {
      // Deliberate local disconnect() is not a lost transport.
      if (reason !== 'io client disconnect') this._bus.emit('disconnected', {});
    });
  }

  _relay(event, payload) {
    const data = payload && typeof payload === 'object' ? payload : {};
    if (event === 'room_joined') this._selfId = data.selfId ?? null;
    if (Array.isArray(data.players)) {
      const self = data.players.find((p) => p.id === this._selfId);
      this._isHost = !!(self && self.isHost);
    }
    this._bus.emit(event, data);
  }

  _send(message, payload) {
    if (this._socket) this._socket.emit(message, payload);
  }

  _teardown() {
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }
    this._selfId = null;
    this._isHost = false;
    this._sendAccum = SEND_INTERVAL;
  }
}
