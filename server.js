const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const MAX_PLAYER_NAME_LENGTH = 32;

const VALID_PLANS = [
  'Helltides',
  'Hordes',
  'Kurast Undercity',
  'Lair Boss',
  'Nightmare Dungeon',
  'Pits',
  'Tree of Whispers',
];

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// In-memory store: { socketId -> { name, plans: [] } }
const players = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Send current state to newly connected player
  socket.emit('init', getPlayerList());

  socket.on('join', (name) => {
    const trimmed = (name || '').trim().slice(0, MAX_PLAYER_NAME_LENGTH) || 'Player';
    players[socket.id] = { name: trimmed, plans: [] };
    io.emit('update', getPlayerList());
  });

  socket.on('submit', (plans) => {
    if (!players[socket.id]) return;
    const validPlans = Array.isArray(plans)
      ? plans.filter((p) => VALID_PLANS.includes(p))
      : [];
    players[socket.id].plans = validPlans;
    io.emit('update', getPlayerList());
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('update', getPlayerList());
  });
});

function getPlayerList() {
  return Object.entries(players).map(([id, data]) => ({
    id,
    name: data.name,
    plans: data.plans,
  }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Diablo War Plan server running on http://localhost:${PORT}`);
});
