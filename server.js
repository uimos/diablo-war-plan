const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const MAX_PLAYER_NAME_LENGTH = 32;

const LAIR_BOSSES = [
  'Grigoire',
  'Beast in the Ice',
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
  'Infernal Hordes',
  'Hordes',
  'The Undercity',
  'Kurast Undercity',
  'Lair Bosses',
  'Lair Boss',
  'Nightmare Dungeons',
  'Nightmare Dungeon',
  'The Pit',
  'Pits',
  ...LAIR_BOSSES.map((boss) => `Lair Boss: ${boss}`),
];

const PLAN_ALIASES = {
  Hordes: 'Infernal Hordes',
  'Kurast Undercity': 'The Undercity',
  'Lair Boss': 'Lair Bosses',
  'Nightmare Dungeon': 'Nightmare Dungeons',
  Pits: 'The Pit',
};

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

function canonicalPlanName(name) {
  if (typeof name !== 'string') return '';
  if (name.startsWith('Lair Boss: ')) return name;
  return PLAN_ALIASES[name] || name;
}

function getOutstandingPlanNames(plans) {
  if (!Array.isArray(plans)) return [];

  return plans
    .map((plan) => (typeof plan === 'string' ? { name: plan, done: false } : plan))
    .filter((plan) => plan && typeof plan.name === 'string' && plan.done !== true)
    .map((plan) => canonicalPlanName(plan.name));
}

function isLairBossActivity(activity) {
  return typeof activity === 'string'
    && (activity === 'Lair Bosses' || activity.startsWith('Lair Boss: '));
}

function recommendBestOrder(playerList) {
  const partySize = playerList.length;
  const playersWithPlans = playerList
    .map((player) => ({
      id: player.id,
      completedCount: Number.isInteger(player.completedCount) ? player.completedCount : 0,
      pending: getOutstandingPlanNames(player.plans),
    }))
    .filter((player) => player.pending.length > 0);

  if (!partySize || !playersWithPlans.length) {
    return {
      generatedAt: Date.now(),
      partySize,
      items: [],
    };
  }

  const maxCompleted = playersWithPlans.reduce(
    (max, player) => Math.max(max, player.completedCount),
    0,
  );

  const queues = playersWithPlans.map((player) => ({
    ...player,
    pending: [...player.pending],
    // Lower completed count gets larger priority weight.
    priorityWeight: (maxCompleted - player.completedCount) + 1,
  }));

  const ordered = [];
  let guard = queues.reduce((sum, player) => sum + player.pending.length, 0);

  while (guard > 0 && queues.some((player) => player.pending.length > 0)) {
    const frontier = new Map();

    queues.forEach((player) => {
      if (!player.pending.length) return;

      const activity = player.pending[0];
      if (!frontier.has(activity)) {
        frontier.set(activity, {
          activity,
          players: 0,
          weightedPriority: 0,
          doneSum: 0,
        });
      }

      const entry = frontier.get(activity);
      entry.players += 1;
      entry.weightedPriority += player.priorityWeight;
      entry.doneSum += player.completedCount;
    });

    if (!frontier.size) break;

    const remainingPlayers = queues.filter((player) => player.pending.length > 0);
    const allOnLastActivity = remainingPlayers.length > 0
      && remainingPlayers.every((player) => player.pending.length === 1);

    const best = Array.from(frontier.values())
      .sort((a, b) => {
        if (allOnLastActivity) {
          const aIsLair = isLairBossActivity(a.activity);
          const bIsLair = isLairBossActivity(b.activity);
          if (aIsLair !== bIsLair) return aIsLair ? -1 : 1;
        }

        if (b.weightedPriority !== a.weightedPriority) return b.weightedPriority - a.weightedPriority;
        if (b.players !== a.players) return b.players - a.players;
        const avgDoneA = a.doneSum / Math.max(1, a.players);
        const avgDoneB = b.doneSum / Math.max(1, b.players);
        if (avgDoneA !== avgDoneB) return avgDoneA - avgDoneB;
        return a.activity.localeCompare(b.activity);
      })[0];

    const reasonParts = [
      `Front-of-queue for ${best.players}/${partySize} players.`,
      'Priority boosted for players with lower done count.',
    ];
    if (allOnLastActivity && isLairBossActivity(best.activity)) {
      reasonParts.push('Final-step rule applied: Lair Boss prioritized.');
    }

    ordered.push({
      activity: best.activity,
      reason: reasonParts.join(' '),
    });

    queues.forEach((player) => {
      if (player.pending[0] === best.activity) {
        player.pending.shift();
      }
    });

    guard -= 1;
  }

  return {
    generatedAt: Date.now(),
    partySize,
    items: ordered,
  };
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

  socket.on('recommend-order', () => {
    const recommendation = recommendBestOrder(getPlayerList());
    io.emit('recommendation', recommendation);
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
