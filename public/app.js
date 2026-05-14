const SKILL_TREES = [
  { key: 'helltides', name: 'Helltides', iconAsset: '/assets/helltide.png' },
  { key: 'hordes', name: 'Infernal Hordes', iconAsset: '/assets/infernal-hordes.png' },
  { key: 'lair-boss', name: 'Lair Bosses', iconAsset: '/assets/lair-bosses.png' },
  { key: 'nightmare-dungeon', name: 'Nightmare Dungeons', iconAsset: '/assets/nightmare-dungeons.png' },
  { key: 'pit', name: 'The Pit', iconAsset: '/assets/the-pit.png' },
  { key: 'undercity', name: 'The Undercity', iconAsset: '/assets/the-undercity.png' },
];

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

const socket = io();
let mySocketId = null;
const PLAYER_NAME_STORAGE_KEY = 'diabloWarPlan.playerName';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const joinScreen    = document.getElementById('join-screen');
const mainScreen    = document.getElementById('main-screen');
const playerNameIn  = document.getElementById('player-name');
const joinBtn       = document.getElementById('join-btn');
const playerLabel   = document.getElementById('player-label');
const logoutBtn     = document.getElementById('logout-btn');
const skillTreesEl  = document.getElementById('skill-trees');
const selectedPicksEl = document.getElementById('selected-picks');
const clearPicksBtn = document.getElementById('clear-picks-btn');
const submitBtn     = document.getElementById('submit-btn');
const playersList   = document.getElementById('players-list');
const suggestOrderBtn = document.getElementById('suggest-order-btn');
const recommendationList = document.getElementById('recommendation-list');
const confirmModal = document.getElementById('confirm-modal');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
const lairBossModal = document.getElementById('lair-boss-modal');
const lairBossCancelBtn = document.getElementById('lair-boss-cancel-btn');
const lairBossOptions = document.getElementById('lair-boss-options');
let currentPicks = [];
let mySubmittedPlans = [];
let pendingConfirmAction = null;

function getSavedPlayerName() {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function savePlayerName(name) {
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
  } catch {
    // Ignore storage errors (private mode / disabled storage).
  }
}

function clearSavedPlayerName() {
  try {
    localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
  } catch {
    // Ignore storage errors (private mode / disabled storage).
  }
}

function isPlanDone(plan) {
  if (typeof plan === 'string') return false;
  return plan?.done === true;
}

// ─── Build skill pick controls ────────────────────────────────────────────────
SKILL_TREES.forEach(({ key, name, iconAsset }) => {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'skill-item';
  item.dataset.name = name;
  item.dataset.key = key;
  item.innerHTML = `
    <img class="skill-icon skill-icon-asset" src="${escHtml(iconAsset)}" alt="${escHtml(name)} icon" />
    <span class="skill-name">${name}</span>
  `;
  item.addEventListener('click', () => {
    if (key === 'lair-boss') {
      openLairBossModal();
      return;
    }

    currentPicks.push(name);
    renderCurrentPicks();
  });
  skillTreesEl.appendChild(item);
});

lairBossOptions.innerHTML = LAIR_BOSSES
  .map((boss) => `<button class="lair-boss-option" type="button" data-boss-name="${escHtml(boss)}">${escHtml(boss)}</button>`)
  .join('');

lairBossOptions.addEventListener('click', (event) => {
  const option = event.target.closest('.lair-boss-option');
  if (!option) return;

  const bossName = option.dataset.bossName;
  if (!bossName) return;

  currentPicks.push(`Lair Boss: ${bossName}`);
  renderCurrentPicks();
  closeLairBossModal();
});

lairBossCancelBtn.addEventListener('click', closeLairBossModal);

lairBossModal.addEventListener('click', (event) => {
  if (event.target === lairBossModal) {
    closeLairBossModal();
  }
});

clearPicksBtn.addEventListener('click', () => {
  currentPicks = [];
  renderCurrentPicks();
});

suggestOrderBtn.addEventListener('click', () => {
  socket.emit('recommend-order');
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

const savedName = getSavedPlayerName();
if (savedName) {
  enterMainAsName(savedName);
}

// ─── Join ─────────────────────────────────────────────────────────────────────
function enterMainAsName(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  savePlayerName(trimmedName);
  playerNameIn.value = trimmedName;
  socket.emit('join', trimmedName);
  playerLabel.textContent = `⚔ ${trimmedName}`;
  joinScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

function doJoin() {
  const name = playerNameIn.value.trim();
  if (!name) {
    playerNameIn.focus();
    return;
  }

  enterMainAsName(name);
}

joinBtn.addEventListener('click', doJoin);
logoutBtn.addEventListener('click', () => {
  clearSavedPlayerName();
  window.location.reload();
});
playerNameIn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJoin();
});

// ─── Submit war plan ──────────────────────────────────────────────────────────
submitBtn.addEventListener('click', () => {
  const hasExistingPlan = mySubmittedPlans.length > 0;
  const hasUnfinishedExistingPlan = hasExistingPlan && mySubmittedPlans.some((plan) => !isPlanDone(plan));

  if (hasUnfinishedExistingPlan) {
    openConfirmModal(submitCurrentPlan);
    return;
  }

  submitCurrentPlan();
});

confirmCancelBtn.addEventListener('click', closeConfirmModal);

confirmSubmitBtn.addEventListener('click', () => {
  if (typeof pendingConfirmAction !== 'function') {
    closeConfirmModal();
    return;
  }

  const action = pendingConfirmAction;
  closeConfirmModal();
  action();
});

confirmModal.addEventListener('click', (event) => {
  if (event.target === confirmModal) {
    closeConfirmModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  if (!lairBossModal.classList.contains('hidden')) {
    closeLairBossModal();
    return;
  }

  if (!confirmModal.classList.contains('hidden')) {
    closeConfirmModal();
  }
});

function openConfirmModal(onConfirm) {
  pendingConfirmAction = onConfirm;
  confirmModal.classList.remove('hidden');
  confirmSubmitBtn.focus();
}

function closeConfirmModal() {
  pendingConfirmAction = null;
  confirmModal.classList.add('hidden');
}

function openLairBossModal() {
  lairBossModal.classList.remove('hidden');
  const firstOption = lairBossOptions.querySelector('.lair-boss-option');
  if (firstOption) firstOption.focus();
}

function closeLairBossModal() {
  lairBossModal.classList.add('hidden');
}

function submitCurrentPlan() {

  socket.emit('submit', {
    plans: currentPicks,
  });

  currentPicks = [];
  renderCurrentPicks();
}

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

socket.on('recommendation', (recommendation) => {
  renderRecommendation(recommendation);
});

// ─── Render players ───────────────────────────────────────────────────────────
function renderPlayers(players) {
  const myPlayer = players.find((player) => player.id === mySocketId);
  mySubmittedPlans = Array.isArray(myPlayer?.plans) ? myPlayer.plans : [];

  if (!players.length) {
    playersList.innerHTML = '<p class="empty-msg">No players yet…</p>';
    return;
  }

  playersList.innerHTML = '';
  players.forEach(({ id, name, plans, completedCount }) => {
    const isMe = id === mySocketId;
    const safeCompletedCount = Number.isInteger(completedCount) && completedCount >= 0 ? completedCount : 0;
    const card = document.createElement('div');
    card.className = 'player-card' + (isMe ? ' is-me' : '');

    const headerHtml = `
      <div class="player-card-header">
        <span class="player-name">${escHtml(name)}</span>
        <span class="progress-count">Done: ${safeCompletedCount}</span>
        ${isMe ? '<span class="me-badge">You</span>' : ''}
      </div>`;

    const progressHtml = isMe
      ? `<div class="plan-progress-row"><p class="plan-progress">Adjust done count</p><div class="plan-progress-edit"><input type="number" class="completed-count-input" min="0" step="1" value="${safeCompletedCount}" data-player-id="${escHtml(id)}" /><button type="button" class="btn btn-secondary btn-small save-completed-count" data-player-id="${escHtml(id)}">Save</button></div></div>`
      : '';

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

function renderRecommendation(recommendation) {
  if (!recommendation || !Array.isArray(recommendation.items) || !recommendation.items.length) {
    recommendationList.innerHTML = '<p class="empty-msg">No recommendation available yet.</p>';
    return;
  }

  recommendationList.innerHTML = recommendation.items
    .map((item, index) => {
      const reason = item.reason || '';
      return `<div class="recommendation-item"><span class="recommendation-rank">${index + 1}.</span><p class="recommendation-activity">${escHtml(item.activity)}</p><span class="recommendation-info" title="${escHtml(reason)}" aria-label="Why this recommendation">ⓘ</span></div>`;
    })
    .join('');
}

playersList.addEventListener('click', (event) => {
  const saveBtn = event.target.closest('.save-completed-count');
  if (saveBtn) {
    const playerId = saveBtn.dataset.playerId;
    if (playerId !== mySocketId) return;

    const row = saveBtn.closest('.plan-progress-edit');
    const input = row?.querySelector('.completed-count-input');
    if (!input) return;

    const nextCompletedCount = Number.parseInt(input.value, 10);
    if (!Number.isInteger(nextCompletedCount) || nextCompletedCount < 0) {
      input.value = '0';
      return;
    }

    socket.emit('set-completed-count', nextCompletedCount);
    return;
  }

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
