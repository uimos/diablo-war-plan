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
    players[socket.id] = { name: trimmed, plans: [], completedCount: 0 };
    io.emit('update', getPlayerList());
  });

  socket.on('submit', (payload) => {
    if (!players[socket.id]) return;

    const plansInput = Array.isArray(payload) ? payload : payload?.plans;
    const validPlans = Array.isArray(plansInput)
      ? plansInput
          .filter((p) => VALID_PLANS.includes(p))
          .map((name) => ({ name, done: false }))
      : [];

    const rawCompletedCount = Array.isArray(payload) ? 0 : payload?.completedCount;
    const completedCount = Number.isInteger(rawCompletedCount) && rawCompletedCount >= 0
      ? rawCompletedCount
      : 0;

    players[socket.id].plans = validPlans;
    players[socket.id].completedCount = completedCount;
    io.emit('update', getPlayerList());
  });

  socket.on('toggle-plan', (planIndex) => {
    if (!players[socket.id]) return;
    if (!Number.isInteger(planIndex)) return;
    if (planIndex < 0 || planIndex >= players[socket.id].plans.length) return;

    const plan = players[socket.id].plans[planIndex];
    plan.done = !plan.done;
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
    completedCount: data.completedCount || 0,
  }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Diablo War Plan server running on http://localhost:${PORT}`);
});
