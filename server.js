const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const MAX_PLAYER_NAME_LENGTH = 32;

const LAIR_BOSSES = [
  'Grigoire',
  'Beast of the Ice',
  'Varshan',
  'Lord Zir',
  'Urivar',
  'Duriel',
  'Andariel',
  'Harbinger of Hatred',
  'Bloody Butcher',
  'Belial',
  'Mephisto',
];

const VALID_PLANS = [
  'Helltides',
  'Hordes',
  'Kurast Undercity',
  'Lair Boss',
  'Nightmare Dungeon',
  'Pits',
  'Tree of Whispers',
  ...LAIR_BOSSES.map((boss) => `Lair Boss: ${boss}`),
];

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'players.json');

app.use(express.static(path.join(__dirname, 'public')));

// In-memory store: { socketId -> { name, plans: [] } }
const players = {};
const playerProfiles = loadProfiles();

function loadProfiles() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Failed to load player profiles:', error);
    return {};
  }
}

function saveProfiles() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(playerProfiles, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save player profiles:', error);
  }
}

function updateProfile(playerData) {
  const profileKey = playerData.name;
  playerProfiles[profileKey] = {
    plans: playerData.plans,
    completedCount: playerData.completedCount,
  };
  saveProfiles();
}

function isPlanFullyDone(plans) {
  return Array.isArray(plans)
    && plans.length > 0
    && plans.every((plan) => plan && plan.done === true);
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Send current state to newly connected player
  socket.emit('init', getPlayerList());

  socket.on('join', (name) => {
    const trimmed = (name || '').trim().slice(0, MAX_PLAYER_NAME_LENGTH) || 'Player';
    const savedProfile = playerProfiles[trimmed];
    players[socket.id] = {
      name: trimmed,
      plans: Array.isArray(savedProfile?.plans) ? savedProfile.plans : [],
      completedCount: Number.isInteger(savedProfile?.completedCount) && savedProfile.completedCount >= 0
        ? savedProfile.completedCount
        : 0,
    };
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

    players[socket.id].plans = validPlans;
    updateProfile(players[socket.id]);
    io.emit('update', getPlayerList());
  });

  socket.on('toggle-plan', (planIndex) => {
    if (!players[socket.id]) return;
    if (!Number.isInteger(planIndex)) return;
    if (planIndex < 0 || planIndex >= players[socket.id].plans.length) return;

    const player = players[socket.id];
    const wasFullyDone = isPlanFullyDone(player.plans);

    const plan = player.plans[planIndex];
    plan.done = !plan.done;
    const isNowFullyDone = isPlanFullyDone(player.plans);

    if (!wasFullyDone && isNowFullyDone) {
      player.completedCount += 1;
    } else if (wasFullyDone && !isNowFullyDone) {
      player.completedCount = Math.max(0, player.completedCount - 1);
    }

    updateProfile(player);
    io.emit('update', getPlayerList());
  });

  socket.on('set-completed-count', (nextCompletedCount) => {
    if (!players[socket.id]) return;
    if (!Number.isInteger(nextCompletedCount) || nextCompletedCount < 0) return;

    players[socket.id].completedCount = nextCompletedCount;
    updateProfile(players[socket.id]);
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
