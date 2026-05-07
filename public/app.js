const SKILL_TREES = [
  { name: 'Helltides',         icon: '🔥' },
  { name: 'Hordes',            icon: '💀' },
  { name: 'Kurast Undercity',  icon: '🏛️' },
  { name: 'Lair Boss',         icon: '🐉' },
  { name: 'Nightmare Dungeon', icon: '🌑' },
  { name: 'Pits',              icon: '⚔️' },
  { name: 'Tree of Whispers',  icon: '🌿' },
];

const socket = io();
let mySocketId = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const joinScreen    = document.getElementById('join-screen');
const mainScreen    = document.getElementById('main-screen');
const playerNameIn  = document.getElementById('player-name');
const joinBtn       = document.getElementById('join-btn');
const playerLabel   = document.getElementById('player-label');
const skillTreesEl  = document.getElementById('skill-trees');
const selectedPicksEl = document.getElementById('selected-picks');
const clearPicksBtn = document.getElementById('clear-picks-btn');
const completedCountIn = document.getElementById('completed-count');
const submitBtn     = document.getElementById('submit-btn');
const playersList   = document.getElementById('players-list');
let currentPicks = [];

// ─── Build skill pick controls ────────────────────────────────────────────────
SKILL_TREES.forEach(({ name, icon }) => {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'skill-item';
  item.dataset.name = name;
  item.innerHTML = `
    <span class="skill-icon">${icon}</span>
    <span class="skill-name">${name}</span>
    <span class="skill-action">Add</span>
  `;
  item.addEventListener('click', () => {
    currentPicks.push(name);
    renderCurrentPicks();
  });
  skillTreesEl.appendChild(item);
});

clearPicksBtn.addEventListener('click', () => {
  currentPicks = [];
  renderCurrentPicks();
});

function renderCurrentPicks() {
  if (!currentPicks.length) {
    selectedPicksEl.innerHTML = '<p class="empty-msg">No picks added yet.</p>';
    clearPicksBtn.disabled = true;
    return;
  }

  selectedPicksEl.innerHTML = currentPicks
    .map((pick, index) => `<span class="plan-tag"><span class="plan-order">${index + 1}.</span> ${escHtml(pick)}</span>`)
    .join('');

  clearPicksBtn.disabled = false;
}

renderCurrentPicks();

// ─── Join ─────────────────────────────────────────────────────────────────────
function doJoin() {
  const name = playerNameIn.value.trim();
  if (!name) {
    playerNameIn.focus();
    return;
  }
  socket.emit('join', name);
  playerLabel.textContent = `⚔ ${name}`;
  joinScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

joinBtn.addEventListener('click', doJoin);
playerNameIn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJoin();
});

// ─── Submit war plan ──────────────────────────────────────────────────────────
submitBtn.addEventListener('click', () => {
  const completedCount = Number.parseInt(completedCountIn.value, 10);
  socket.emit('submit', {
    plans: currentPicks,
    completedCount: Number.isInteger(completedCount) && completedCount >= 0 ? completedCount : 0,
  });
});

// ─── Socket events ────────────────────────────────────────────────────────────
socket.on('connect', () => {
  mySocketId = socket.id;
});

socket.on('init', (players) => {
  renderPlayers(players);
});

socket.on('update', (players) => {
  renderPlayers(players);
});

// ─── Render players ───────────────────────────────────────────────────────────
function renderPlayers(players) {
  if (!players.length) {
    playersList.innerHTML = '<p class="empty-msg">No players yet…</p>';
    return;
  }

  playersList.innerHTML = '';
  players.forEach(({ id, name, plans, completedCount }) => {
    const isMe = id === mySocketId;
    const card = document.createElement('div');
    card.className = 'player-card' + (isMe ? ' is-me' : '');

    const headerHtml = `
      <div class="player-card-header">
        <span class="player-name">${escHtml(name)}</span>
        ${isMe ? '<span class="me-badge">You</span>' : ''}
      </div>`;

    const progressHtml = `<p class="plan-progress">Done count: <span class="progress-count">${Number.isInteger(completedCount) ? completedCount : 0}</span></p>`;

    const plansHtml = plans.length
      ? `<div class="plan-tags">${plans.map((plan, index) => renderPlanTag(plan, index, id, isMe)).join('')}</div>`
      : '<p class="no-plan">No plan selected yet</p>';

    card.innerHTML = headerHtml + progressHtml + plansHtml;
    playersList.appendChild(card);
  });
}

function renderPlanTag(plan, index, playerId, isMe) {
  const normalized = typeof plan === 'string'
    ? { name: plan, done: false }
    : { name: plan.name, done: Boolean(plan.done) };

  const doneClass = normalized.done ? ' is-done' : '';
  const icon = normalized.done ? '✔' : '○';

  if (isMe) {
    return `<button class="plan-tag plan-toggle${doneClass}" type="button" data-player-id="${escHtml(playerId)}" data-plan-index="${index}" title="Toggle done"><span class="plan-order">${index + 1}.</span> ${escHtml(normalized.name)} <span class="plan-state">${icon}</span></button>`;
  }

  return `<span class="plan-tag${doneClass}"><span class="plan-order">${index + 1}.</span> ${escHtml(normalized.name)} <span class="plan-state">${icon}</span></span>`;
}

playersList.addEventListener('click', (event) => {
  const btn = event.target.closest('.plan-toggle');
  if (!btn) return;
  const playerId = btn.dataset.playerId;
  const planIndex = Number(btn.dataset.planIndex);

  if (playerId !== mySocketId || !Number.isInteger(planIndex)) return;
  socket.emit('toggle-plan', planIndex);
});

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
