/**
 * UIManager — Controls all HUD DOM elements
 */
const UIManager = (() => {
  const el = {};

  function init() {
    const ids = [
      'power-fill', 'mob-power-fill',
      'elevation-value', 'azimuth-value',
      'wind-value', 'wind-arrow', 'score-value', 'ammo-value',
      'level-display', 'hit-counter', 'status-msg',
      'reload-bar', 'reload-fill', 'main-menu', 'hud',
      'combo-display', 'accuracy-display'
    ];
    ids.forEach(id => { el[id] = document.getElementById(id); });

    // Prevent accidental page scroll / zoom during gameplay only
    // (allow touchmove on main-menu so it can scroll on mobile)
    document.addEventListener('touchmove', e => {
      const menu = document.getElementById('main-menu');
      if (menu && menu.style.display !== 'none' && menu.contains(e.target)) return;
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  function showMenu() {
    if (el['main-menu']) el['main-menu'].style.display = 'flex';
    if (el['hud'])       el['hud'].style.display = 'none';
  }

  function hideMenu() {
    if (el['main-menu']) el['main-menu'].style.display = 'none';
    if (el['hud'])       el['hud'].style.display = 'flex';
  }

  /** power: 0.0 → 1.0 */
  function updatePower(power) {
    const pct = Math.max(0, Math.min(1, power));
    const r = Math.floor(60 + pct * 195);
    const g = Math.floor(220 - pct * 180);
    const grad = `linear-gradient(to top, rgb(${r},${g},0), rgb(${Math.min(255,r+40)},${Math.max(0,g+20)},0))`;
    const glow = `0 0 ${8 + pct * 14}px rgba(${r},${g},0,0.7)`;

    // Desktop vertical bar
    if (el['power-fill']) {
      el['power-fill'].style.height     = (pct * 100) + '%';
      el['power-fill'].style.background = grad;
      el['power-fill'].style.boxShadow  = glow;
    }
    // Mobile horizontal bar
    if (el['mob-power-fill']) {
      el['mob-power-fill'].style.width      = (pct * 100) + '%';
      el['mob-power-fill'].style.background = `linear-gradient(90deg, #3DFF7A, #FFB833)`;
      el['mob-power-fill'].style.opacity    = 0.5 + pct * 0.5;
    }
  }

  function updateAngles(elevDeg, azimDeg) {
    if (el['elevation-value']) el['elevation-value'].textContent = elevDeg.toFixed(1) + '°';
    if (el['azimuth-value'])   el['azimuth-value'].textContent   = azimDeg.toFixed(1) + '°';
  }

  function updateWind(wind) {
    const speed = Math.sqrt(wind.x * wind.x + wind.z * wind.z);
    const angleDeg = Math.atan2(wind.x, wind.z) * 180 / Math.PI;
    if (el['wind-value'])  el['wind-value'].textContent = speed.toFixed(1) + ' m/s';
    if (el['wind-arrow'])  el['wind-arrow'].style.transform = `rotate(${angleDeg}deg)`;
  }

  function updateScore(score, ammo) {
    if (el['score-value']) el['score-value'].textContent = score.toLocaleString();
    if (el['ammo-value'])  el['ammo-value'].textContent  = ammo;
  }

  function updateHitCounter(hits, total) {
    if (el['hit-counter']) el['hit-counter'].textContent = `${hits}/${total}`;
  }

  function updateLevel(level) {
    if (el['level-display']) el['level-display'].textContent = `LEVEL ${level}`;
  }

  let statusTimer = null;
  function showStatus(msg, duration = 2200) {
    if (!el['status-msg']) return;
    el['status-msg'].textContent = msg;
    el['status-msg'].classList.add('visible');
    clearTimeout(statusTimer);
    if (duration < 90000) {
      statusTimer = setTimeout(() => el['status-msg'].classList.remove('visible'), duration);
    }
  }

  function showReloadBar(visible) {
    if (el['reload-bar']) el['reload-bar'].style.display = visible ? 'block' : 'none';
  }

  /** progress: 0.0 → 1.0 */
  function updateReloadProgress(progress) {
    if (el['reload-fill']) el['reload-fill'].style.width = (progress * 100) + '%';
  }

  function showCombo(combo) {
    if (!el['combo-display'] || combo <= 1) return;
    el['combo-display'].textContent = `${combo}× COMBO!`;
    el['combo-display'].classList.add('visible');
    clearTimeout(el['combo-display']._timer);
    el['combo-display']._timer = setTimeout(() => el['combo-display'].classList.remove('visible'), 1600);
  }

  function screenShake(intensity = 1.0) {
    const startTime = Date.now();
    const duration  = 350;
    const strength  = Math.min(intensity * 9, 16);

    (function shake() {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        document.body.style.transform = '';
        return;
      }
      const t = elapsed / duration;
      const amp = strength * (1 - t);
      document.body.style.transform = `translate(${(Math.random() - 0.5) * amp}px, ${(Math.random() - 0.5) * amp}px)`;
      requestAnimationFrame(shake);
    })();
  }

  /** Update the difficulty badge colour + label in the HUD */
  function updateDifficulty(label, color) {
    const badge = document.getElementById('diff-badge');
    if (badge) {
      badge.textContent = label;
      badge.style.color = color;
      badge.style.textShadow = `0 0 10px ${color}88`;
      badge.style.borderColor = color + '55';
    }
  }

  /** Update cannon position readout */
  function updatePosition(x, z) {
    const posEl = document.getElementById('cannon-pos');
    if (posEl) posEl.textContent = `${x.toFixed(0)}, ${z.toFixed(0)}`;
  }

  return {
    init, showMenu, hideMenu,
    updatePower, updateAngles, updateWind,
    updateScore, updateHitCounter, updateLevel,
    showStatus, showReloadBar, updateReloadProgress,
    showCombo, screenShake,
    updateDifficulty, updatePosition
  };
})();
