// MONKEYALARM! multiplayer server. Plain Node 22 ES module: an http server
// hosting socket.io, a registry of rooms, and per-socket wiring that forwards
// every client message to the socket's current room. All game rules live in
// Room.js.

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { NET } from '../client/core/constants.js';
import { Room, sanitizeName } from './Room.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** @type {Map<string, Room>} roomCode -> Room */
const rooms = new Map();

/**
 * Generates an unused 4-letter uppercase room code.
 * @returns {string}
 */
function generateRoomCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
  } while (rooms.has(code));
  return code;
}

/** Coerces an arbitrary payload into a plain object. */
function asObject(payload) {
  return payload && typeof payload === 'object' ? payload : {};
}

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  /** @type {Room | null} the room this socket currently belongs to */
  let room = null;

  const leaveCurrentRoom = () => {
    if (!room) return;
    room.removeMember(socket.id);
    if (room.isEmpty) {
      room.destroy();
      rooms.delete(room.code);
    }
    room = null;
  };

  socket.on('create_room', (payload) => {
    const { name, modeId, mapId, botCount = 0, botDifficulty = 'medium' } = asObject(payload);
    leaveCurrentRoom();
    const code = generateRoomCode();
    room = new Room(io, code, { modeId, mapId, botCount: Math.min(10, Math.max(0, Number(botCount)||0)), botDifficulty });
    rooms.set(code, room);
    room.addMember(socket, sanitizeName(name));
  });

  socket.on('join_room', (payload) => {
    const { name, roomCode } = asObject(payload);
    const code = String(roomCode ?? '').trim().toUpperCase();
    const target = rooms.get(code);
    if (!target) {
      socket.emit('error_msg', { message: 'Room not found' });
      return;
    }
    if (target.isLocked) {
      socket.emit('error_msg', { message: 'Game already in progress' });
      return;
    }
    leaveCurrentRoom();
    room = target;
    room.addMember(socket, sanitizeName(name));
  });

  socket.on('leave_room', () => leaveCurrentRoom());

  socket.on('set_ready', (payload) => {
    if (room) room.setReady(socket.id, !!asObject(payload).ready);
  });

  socket.on('update_settings', (payload) => {
    if (room) room.updateSettings(socket.id, asObject(payload));
  });

  socket.on('start_game', () => {
    if (room) room.startGame(socket.id);
  });

  socket.on('next_round', () => {
    if (room) room.nextRound(socket.id);
  });

  socket.on('loaded', () => {
    if (room) room.notifyLoaded(socket.id);
  });

  socket.on('state', (payload) => {
    if (room) room.handleState(socket.id, payload);
  });

  socket.on('catch', (payload) => {
    if (room) room.attemptCatch(socket.id, asObject(payload).targetId);
  });

  socket.on('disconnect', () => leaveCurrentRoom());
});

const port = Number(process.env.PORT) || NET.PORT;
httpServer.listen(port, () => {
  console.log(`MONKEYALARM! server listening on http://localhost:${port}`);
});
