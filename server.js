const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 25000, pingTimeout: 20000 });
const PORT = Number(process.env.PORT || 3001);
const rooms = new Map();

app.use(express.static(__dirname));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'Highway Rush', rooms: rooms.size }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function cleanName(value) {
  const name = String(value || 'Driver').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 18);
  return name || 'Driver';
}
function roomPlayers(room) { return [...room.players.values()]; }
function spawnOffset(index) { return [0, 3.0, -3.0, 1.5, -1.5, 4.5, -4.5, 0][index] || 0; }
function detachSocketFromRoom(socket) {
  const code = socket.data.roomCode;
  const room = code && rooms.get(code);
  if (!room) { delete socket.data.roomCode; return; }
  room.players.delete(socket.id);
  socket.leave(code);
  delete socket.data.roomCode;
  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  io.to(code).emit('player:left', { id: socket.id, players: room.players.size });
  io.to(code).emit('room:players', { players: roomPlayers(room), hostId: room.hostId });
}

io.on('connection', socket => {
  socket.on('room:create', payload => {
    detachSocketFromRoom(socket);
    const roomCode = makeCode();
    const player = { id: socket.id, name: cleanName(payload && payload.name), x: 0, score: 0, speed: 173, color: 0x13a9bd };
    const room = { code: roomCode, hostId: socket.id, started: false, players: new Map([[socket.id, player]]) };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.emit('room:joined', { roomCode, isHost: true, started: false, players: roomPlayers(room) });
  });

  socket.on('room:join', payload => {
    const code = String(payload && payload.roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return socket.emit('room:error', 'Room not found. Check the code and try again.');
    if (socket.data.roomCode === code) {
      socket.emit('room:joined', { roomCode: code, isHost: room.hostId === socket.id, started: room.started, players: roomPlayers(room) });
      return;
    }
    if (room.players.size >= 8) return socket.emit('room:error', 'This room is full (maximum 8 players).');
    if (room.started) return socket.emit('room:error', 'This race has already started. Join another room.');
    detachSocketFromRoom(socket);
    const player = { id: socket.id, name: cleanName(payload && payload.name), x: spawnOffset(room.players.size), score: 0, speed: 173, color: [0xf28b48, 0x8b78e6, 0xe25a75, 0x54bf82, 0xd5dce5][(room.players.size - 1) % 5] };
    room.players.set(socket.id, player);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room:joined', { roomCode: code, isHost: false, started: room.started, players: roomPlayers(room) });
    io.to(code).emit('room:players', { players: roomPlayers(room), hostId: room.hostId });
  });

  socket.on('race:start', payload => {
    const code = socket.data.roomCode;
    const room = code && rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    room.started = true;
    room.level = Math.max(1, Math.min(5, Number(payload && payload.level) || 1));
    io.to(code).emit('race:start', { level: room.level });
  });

  socket.on('player:update', payload => {
    const code = socket.data.roomCode;
    const room = code && rooms.get(code);
    if (!room || !room.players.has(socket.id) || !payload) return;
    const current = room.players.get(socket.id);
    current.x = Math.max(-5, Math.min(5, Number(payload.x) || 0));
    current.score = Math.max(0, Math.min(100000000, Number(payload.score) || 0));
    current.speed = Math.max(0, Math.min(500, Number(payload.speed) || 173));
    current.name = cleanName(payload.name || current.name);
    socket.to(code).volatile.emit('player:update', { id: socket.id, player: current });
  });

  socket.on('disconnect', () => {
    detachSocketFromRoom(socket);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nHIGHWAY RUSH is running: http://localhost:${PORT}`);
  console.log('LAN multiplayer: share this computer LAN IP and the same room code.');
  console.log('Press Ctrl+C to stop the server.\n');
});
