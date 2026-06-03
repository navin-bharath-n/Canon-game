/**
 * COSMIC MEMORY — Space Card Match Game
 * Full game logic: state machine, card grid, timer, scoring, combos,
 * power-ups, leaderboard, particles, starfield, and audio synthesis.
 */

'use strict';

/* ============================================================
   CONFIG
   ============================================================ */
const DIFFICULTY = {
  easy:   { pairs: 8,  cols: 4, time: 90,  scorePerMatch: 100, timeBonus: 5 },
  medium: { pairs: 10, cols: 5, time: 75,  scorePerMatch: 120, timeBonus: 4 },
  hard:   { pairs: 18, cols: 6, time: 60,  scorePerMatch: 150, timeBonus: 3 },
};

const SYMBOLS = ['🪐','⭐','🚀','☄️','🌙','👽','🛸','🌠','💫','🔭','🌍','🌌','🛰️','⚡','🪄','💎','🔮','🌀'];

const POWERUPS = [
  { id: 'freeze',  icon: '❄️', label: 'TIME FREEZE +10s',  duration: null },
  { id: 'reveal',  icon: '👁️', label: 'FLASH REVEAL',      duration: 1500 },
  { id: 'double',  icon: '⚡', label: '2× SCORE (5 sec)',   duration: 5000 },
];

/* ============================================================
   STATE
   ============================================================ */
let state = {
  screen: 'menu',          // menu | game | pause | over | how | leaderboard
  difficulty: 'easy',
  cards: [],               // [{id, symbol, flipped, matched, el}]
  flipped: [],             // indices of currently flipped (unmatched) cards
  locked: false,           // block input while animating
  score: 0,
  combo: 0,
  bestCombo: 1,
  pairs: 0,
  totalPairs: 0,
  timeLeft: 60,
  timerInterval: null,
  doubleScore: false,
  doubleTimeout: null,
  bestScore: 0,
};

/* ============================================================
   DOM REFS
   ============================================================ */
const $ = id => document.getElementById(id);
const screens = {
  menu:        $('screen-menu'),
  game:        $('screen-game'),
  pause:       $('screen-pause'),
  over:        $('screen-over'),
  how:         $('screen-how'),
  leaderboard: $('screen-leaderboard'),
};

/* ============================================================
   SCREEN MANAGER
   ============================================================ */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  state.screen = name;
}

/* ============================================================
   AUDIO (Web Audio API synthesis)
   ============================================================ */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.15, gain = 0.18, delay = 0) {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch(_) {}
}

const SFX = {
  flip:  () => playTone(440, 'sine',     0.08, 0.12),
  match: () => {
    playTone(523, 'sine', 0.12, 0.15, 0);
    playTone(659, 'sine', 0.12, 0.15, 0.1);
    playTone(784, 'sine', 0.14, 0.18, 0.2);
  },
  wrong: () => playTone(180, 'sawtooth', 0.2,  0.1),
  combo: () => {
    playTone(880, 'sine', 0.08, 0.15, 0);
    playTone(1100,'sine', 0.08, 0.15, 0.08);
    playTone(1320,'sine', 0.1,  0.2,  0.16);
  },
  win:   () => {
    [523,659,784,1047].forEach((f, i) => playTone(f, 'sine', 0.2, 0.18, i * 0.12));
  },
  lose:  () => {
    playTone(330, 'sawtooth', 0.15, 0.1, 0);
    playTone(277, 'sawtooth', 0.15, 0.1, 0.15);
    playTone(220, 'sawtooth', 0.2,  0.1, 0.3);
  },
  pu:    () => playTone(880, 'triangle', 0.15, 0.2),
};

/* ============================================================
   STARFIELD
   ============================================================ */
const canvas = $('starfield');
const ctx2 = canvas.getContext('2d');
let stars = [];

function initStars() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  stars = Array.from({length: 200}, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * canvas.height,
    r:    Math.random() * 1.5 + 0.2,
    a:    Math.random(),
    da:   (Math.random() - 0.5) * 0.008,
    speed: Math.random() * 0.08 + 0.02,
  }));
}

function drawStars() {
  ctx2.clearRect(0, 0, canvas.width, canvas.height);
  stars.forEach(s => {
    s.a = Math.max(0.1, Math.min(1, s.a + s.da));
    if (s.a <= 0.1 || s.a >= 1) s.da *= -1;
    s.y += s.speed;
    if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
    ctx2.beginPath();
    ctx2.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx2.fillStyle = `rgba(${180 + Math.random()*75}, ${180 + Math.random()*75}, 255, ${s.a})`;
    ctx2.fill();
  });
  requestAnimationFrame(drawStars);
}

/* ============================================================
   PARTICLES
   ============================================================ */
const particleContainer = $('particle-container');
function burst(x, y, color = '#8250ff') {
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle  = (i / 14) * Math.PI * 2;
    const dist   = 40 + Math.random() * 60;
    p.style.cssText = `
      left: ${x}px; top: ${y}px;
      width: ${4 + Math.random()*5}px;
      height: ${4 + Math.random()*5}px;
      background: ${color};
      box-shadow: 0 0 6px ${color};
      --tx: ${Math.cos(angle) * dist}px;
      --ty: ${Math.sin(angle) * dist}px;
    `;
    particleContainer.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

function burstFromCard(cardEl, color) {
  const r = cardEl.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, color);
}

/* ============================================================
   SCORE POP
   ============================================================ */
function popScore(x, y, text, color = '#00e5ff') {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.textContent = text;
  el.style.cssText = `left:${x}px; top:${y}px; color:${color};`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/* ============================================================
   COMBO FLASH
   ============================================================ */
const comboFlashEl = $('combo-flash');
function showComboFlash(text, color = '#ffd700') {
  comboFlashEl.textContent = text;
  comboFlashEl.style.color = color;
  comboFlashEl.style.textShadow = `0 0 20px ${color}`;
  comboFlashEl.classList.remove('show');
  void comboFlashEl.offsetWidth; // reflow
  comboFlashEl.classList.add('show');
}

/* ============================================================
   HUD UPDATES
   ============================================================ */
function updateHUD() {
  $('hud-score').textContent  = state.score.toLocaleString();
  $('hud-combo').textContent  = `x${state.combo + 1}`;
  $('hud-pairs').textContent  = `${state.pairs}/${state.totalPairs}`;

  const totalTime = DIFFICULTY[state.difficulty].time;
  const pct = state.timeLeft / totalTime;
  const circumference = 213.6;
  const offset = circumference * (1 - pct);
  const ring = $('ring-fill');
  ring.style.strokeDashoffset = offset;

  // Color ring based on time
  if (pct > 0.5)       ring.style.stroke = '#00e5ff';
  else if (pct > 0.25) ring.style.stroke = '#ffd700';
  else                 ring.style.stroke = '#ff3b5c';

  $('hud-time').textContent = state.timeLeft;
}

/* ============================================================
   CARD GRID
   ============================================================ */
function buildGrid() {
  const diff   = DIFFICULTY[state.difficulty];
  const grid   = $('card-grid');
  grid.innerHTML = '';
  grid.className = `grid-${state.difficulty}`;

  // Pick symbols
  const pool = [...SYMBOLS].slice(0, diff.pairs);
  const deck = [...pool, ...pool].sort(() => Math.random() - 0.5);

  state.cards = deck.map((symbol, idx) => {
    const card = {
      id: idx,
      symbol,
      flipped: false,
      matched: false,
      el: null,
    };

    const el = document.createElement('div');
    el.className = 'card';
    el.setAttribute('role', 'gridcell');
    el.setAttribute('aria-label', `Card ${idx + 1}`);
    el.setAttribute('tabindex', '0');
    el.id = `card-${idx}`;

    el.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back-face"></div>
        <div class="card-face card-front-face">${symbol}</div>
      </div>
    `;

    el.addEventListener('click', () => onCardClick(card));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onCardClick(card); });

    grid.appendChild(el);
    card.el = el;
    return card;
  });

  state.totalPairs = diff.pairs;
  state.flipped    = [];
  state.locked     = false;
}

/* ============================================================
   CARD CLICK
   ============================================================ */
function onCardClick(card) {
  if (state.locked)          return;
  if (card.flipped)          return;
  if (card.matched)          return;
  if (state.flipped.length >= 2) return;
  if (state.screen !== 'game')   return;

  // Flip it
  card.flipped = true;
  card.el.classList.add('flipped');
  SFX.flip();
  state.flipped.push(card);

  if (state.flipped.length === 2) {
    state.locked = true;
    setTimeout(checkMatch, 700);
  }
}

/* ============================================================
   MATCH CHECK
   ============================================================ */
function checkMatch() {
  const [a, b] = state.flipped;

  if (a.symbol === b.symbol) {
    // MATCH
    a.matched = b.matched = true;
    a.el.classList.add('matched');
    b.el.classList.add('matched');

    state.combo++;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.pairs++;

    const diff      = DIFFICULTY[state.difficulty];
    const multiplier = state.doubleScore ? 2 : 1;
    const baseScore  = diff.scorePerMatch * (1 + state.combo * 0.25) * multiplier;
    const timeBonus  = state.timeLeft * diff.timeBonus * multiplier;
    const gained     = Math.round(baseScore + timeBonus * 0.1);
    state.score     += gained;

    // Particles
    burstFromCard(a.el, '#00ff88');
    burstFromCard(b.el, '#00ff88');

    // Score pop
    const r = b.el.getBoundingClientRect();
    popScore(r.left + r.width/2, r.top, `+${gained}`, '#00ff88');

    // Combo feedback
    if (state.combo >= 2) {
      const labels = ['','','DOUBLE!','TRIPLE!','QUAD!','PENTA!','ULTRA!'];
      const lbl = state.combo <= 6 ? labels[state.combo] : `x${state.combo} COMBO!`;
      showComboFlash(lbl, state.combo >= 4 ? '#ff4db8' : '#ffd700');
      if (state.combo >= 3) SFX.combo();
      else SFX.match();
    } else {
      SFX.match();
    }

    // Maybe spawn power-up
    if (state.pairs % 3 === 0 && state.pairs < state.totalPairs) {
      setTimeout(spawnPowerup, 600);
    }

    state.flipped = [];
    state.locked  = false;
    updateHUD();

    if (state.pairs === state.totalPairs) {
      setTimeout(winGame, 500);
    }
  } else {
    // MISMATCH
    state.combo = 0;
    SFX.wrong();
    a.el.classList.add('wrong');
    b.el.classList.add('wrong');

    setTimeout(() => {
      a.flipped = b.flipped = false;
      a.el.classList.remove('flipped', 'wrong');
      b.el.classList.remove('flipped', 'wrong');
      state.flipped = [];
      state.locked  = false;
      updateHUD();
    }, 900);
  }
}

/* ============================================================
   POWER-UPS
   ============================================================ */
function spawnPowerup() {
  const pu  = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
  const tray = $('powerup-tray');
  const badge = document.createElement('div');
  badge.className = 'pu-badge';
  badge.textContent = `${pu.icon} ${pu.label}`;
  tray.appendChild(badge);
  SFX.pu();

  // Apply
  if (pu.id === 'freeze') {
    state.timeLeft = Math.min(state.timeLeft + 10, DIFFICULTY[state.difficulty].time);
    updateHUD();
  } else if (pu.id === 'reveal') {
    flashRevealAll(pu.duration);
  } else if (pu.id === 'double') {
    state.doubleScore = true;
    if (state.doubleTimeout) clearTimeout(state.doubleTimeout);
    state.doubleTimeout = setTimeout(() => { state.doubleScore = false; }, pu.duration);
  }

  setTimeout(() => badge.remove(), 3500);
}

function flashRevealAll(duration) {
  const unmatched = state.cards.filter(c => !c.matched && !c.flipped);
  unmatched.forEach(c => c.el.classList.add('flipped'));
  setTimeout(() => {
    unmatched.forEach(c => {
      if (!c.matched) c.el.classList.remove('flipped');
    });
  }, duration);
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if (state.screen !== 'game') return;
    state.timeLeft--;
    updateHUD();
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      updateHUD();
      clearInterval(state.timerInterval);
      loseGame();
    }
    // Urgent glow when low
    if (state.timeLeft <= 10) {
      $('timer-ring').style.animation = 'none';
      $('hud-time').style.color = '#ff3b5c';
    }
  }, 1000);
}

/* ============================================================
   GAME FLOW
   ============================================================ */
function startGame() {
  const diff = DIFFICULTY[state.difficulty];
  state.score     = 0;
  state.combo     = 0;
  state.bestCombo = 1;
  state.pairs     = 0;
  state.timeLeft  = diff.time;
  state.doubleScore = false;
  $('powerup-tray').innerHTML = '';
  $('hud-time').style.color   = '';

  buildGrid();
  updateHUD();
  showScreen('game');
  startTimer();
}

function pauseGame() {
  clearInterval(state.timerInterval);
  showScreen('pause');
}

function resumeGame() {
  showScreen('game');
  startTimer();
}

function winGame() {
  clearInterval(state.timerInterval);
  SFX.win();
  burst(window.innerWidth/2, window.innerHeight/2, '#ffd700');
  burst(window.innerWidth/2 - 80, window.innerHeight/2, '#00e5ff');
  burst(window.innerWidth/2 + 80, window.innerHeight/2, '#8250ff');

  const best = getBest();
  if (state.score > best) saveBest(state.score);

  $('over-icon').textContent    = '🏆';
  $('over-title').textContent   = 'MISSION COMPLETE!';
  $('over-msg').textContent     = 'You\'ve mapped the cosmos, Commander!';
  $('res-score').textContent    = state.score.toLocaleString();
  $('res-pairs').textContent    = state.pairs;
  $('res-combo').textContent    = `x${state.bestCombo}`;
  $('res-best').textContent     = Math.max(state.score, best).toLocaleString();
  showScreen('over');
}

function loseGame() {
  clearInterval(state.timerInterval);
  SFX.lose();
  burst(window.innerWidth/2, window.innerHeight/2, '#ff3b5c');

  const best = getBest();
  if (state.score > best) saveBest(state.score);

  $('over-icon').textContent    = '💀';
  $('over-title').textContent   = 'TIME\'S UP!';
  $('over-msg').textContent     = `You matched ${state.pairs} of ${state.totalPairs} pairs…`;
  $('res-score').textContent    = state.score.toLocaleString();
  $('res-pairs').textContent    = `${state.pairs}/${state.totalPairs}`;
  $('res-combo').textContent    = `x${state.bestCombo}`;
  $('res-best').textContent     = Math.max(state.score, best).toLocaleString();
  showScreen('over');
}

/* ============================================================
   LEADERBOARD
   ============================================================ */
const LB_KEY = 'cosmicMemory_lb';

function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
  catch(_) { return []; }
}

function saveToLeaderboard(name, score, diff) {
  const lb = getLeaderboard();
  lb.push({ name, score, diff, date: Date.now() });
  lb.sort((a, b) => b.score - a.score);
  lb.splice(10); // keep top 10
  localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

function renderLeaderboard() {
  const lb  = getLeaderboard();
  const el  = $('leaderboard-list');
  if (!lb.length) {
    el.innerHTML = '<div class="lb-empty">No scores yet. Be the first, Commander!</div>';
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  el.innerHTML = lb.map((e, i) => `
    <div class="lb-entry">
      <span class="lb-rank">${medals[i] || `${i+1}`}</span>
      <span class="lb-name">${e.name || 'Anonymous'}</span>
      <span class="lb-score">${e.score.toLocaleString()}</span>
      <span class="lb-diff">${e.diff?.toUpperCase() || ''}</span>
    </div>
  `).join('');
}

function getBest() {
  const lb = getLeaderboard();
  return lb.length ? lb[0].score : 0;
}
function saveBest(score) {
  // The full leaderboard save handles best scores
}

/* ============================================================
   EVENT LISTENERS — Buttons
   ============================================================ */
// Menu
$('btn-play').addEventListener('click', () => startGame());
$('btn-how').addEventListener('click',  () => showScreen('how'));
$('btn-leaderboard').addEventListener('click', () => {
  renderLeaderboard();
  showScreen('leaderboard');
});

// Difficulty
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
  });
});

// How to play
$('btn-how-back').addEventListener('click', () => showScreen('menu'));

// Leaderboard
$('btn-lb-back').addEventListener('click', () => showScreen('menu'));
$('btn-lb-clear').addEventListener('click', () => {
  localStorage.removeItem(LB_KEY);
  renderLeaderboard();
});

// Game controls
$('btn-pause').addEventListener('click',  () => pauseGame());
$('btn-quit').addEventListener('click',   () => {
  clearInterval(state.timerInterval);
  showScreen('menu');
});

// Pause
$('btn-resume').addEventListener('click',     () => resumeGame());
$('btn-restart').addEventListener('click',    () => startGame());
$('btn-pause-menu').addEventListener('click', () => {
  clearInterval(state.timerInterval);
  showScreen('menu');
});

// Game Over
$('btn-save-score').addEventListener('click', () => {
  const name = $('player-name').value.trim() || 'Anonymous';
  saveToLeaderboard(name, state.score, state.difficulty);
  $('btn-save-score').disabled = true;
  $('btn-save-score').textContent = '✓ SAVED!';
  $('name-entry').style.opacity = '0.4';
});
$('btn-play-again').addEventListener('click', () => startGame());
$('btn-over-menu').addEventListener('click',  () => showScreen('menu'));

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state.screen === 'game')  pauseGame();
    else if (state.screen === 'pause') resumeGame();
    else if (state.screen !== 'menu') showScreen('menu');
  }
  if (e.key === 'Enter' && state.screen === 'menu') startGame();
});

/* ============================================================
   RESIZE
   ============================================================ */
window.addEventListener('resize', () => {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars();
});

/* ============================================================
   INIT
   ============================================================ */
initStars();
drawStars();
showScreen('menu');

// Animate preview cards properly
const previews = document.querySelectorAll('.preview-card');
previews.forEach((card, i) => {
  setInterval(() => {
    card.classList.toggle('flipped');
  }, 2000 + i * 500);
});
