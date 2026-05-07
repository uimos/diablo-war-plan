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
const submitBtn     = document.getElementById('submit-btn');
const playersList   = document.getElementById('players-list');

// ─── Build skill-tree checkboxes ─────────────────────────────────────────────
SKILL_TREES.forEach(({ name, icon }) => {
  const item = document.createElement('label');
  item.className = 'skill-item';
  item.dataset.name = name;
  item.innerHTML = `
    <input type="checkbox" value="${name}" />
    <span class="skill-icon">${icon}</span>
    <span class="skill-name">${name}</span>
    <span class="checkmark">✓</span>
  `;
  const cb = item.querySelector('input[type="checkbox"]');
  cb.addEventListener('change', () => {
    item.classList.toggle('selected', cb.checked);
  });
  skillTreesEl.appendChild(item);
});

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
  const selected = Array.from(
    skillTreesEl.querySelectorAll('input[type="checkbox"]:checked')
  ).map((cb) => cb.value);
  socket.emit('submit', selected);
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
  players.forEach(({ id, name, plans }) => {
    const isMe = id === mySocketId;
    const card = document.createElement('div');
    card.className = 'player-card' + (isMe ? ' is-me' : '');

    const headerHtml = `
      <div class="player-card-header">
        <span class="player-name">${escHtml(name)}</span>
        ${isMe ? '<span class="me-badge">You</span>' : ''}
      </div>`;

    const plansHtml = plans.length
      ? `<div class="plan-tags">${plans.map((p) => `<span class="plan-tag">${escHtml(p)}</span>`).join('')}</div>`
      : '<p class="no-plan">No plan selected yet</p>';

    card.innerHTML = headerHtml + plansHtml;
    playersList.appendChild(card);
  });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
