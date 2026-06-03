/**
 * AudioEngine — Procedural sound synthesis via Web Audio API
 */
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;

  function init() {
    // Don't create AudioContext here — browsers block it before a user gesture.
    // It will be created lazily on the first resume() call (triggered by user input).
  }

  function resume() {
    // Lazily create context on first user gesture
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = muted ? 0 : 0.55;
        masterGain.connect(ctx.destination);
      } catch (e) {
        console.warn('Web Audio API not available:', e);
        return;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (masterGain) masterGain.gain.value = m ? 0 : 0.55;
  }

  // Utility: connect chain
  function chain(nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(masterGain);
  }

  function playCannonFire() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;

    // Low-frequency boom oscillators
    const boomData = [
      { freq: 80, targetFreq: 28, dur: 0.7, gain: 0.9 },
      { freq: 55, targetFreq: 18, dur: 0.5, gain: 0.65 },
      { freq: 120, targetFreq: 40, dur: 0.4, gain: 0.45 },
    ];
    boomData.forEach(({ freq, targetFreq, dur, gain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, now + dur);
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      chain([osc, g]);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    });

    // High crack noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.1, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    chain([src, hp, crackGain]);
    src.start(now);
  }

  function playExplosion(intensity = 1.0) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;

    // Noise rumble
    const bufLen = Math.floor(ctx.sampleRate * 2.0);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const t = i / bufLen;
      d[i] = (Math.random() * 2 - 1) * Math.pow(Math.max(0, 1 - t * 1.8), 1.4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = intensity * 1.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 350;
    chain([src, lp, g]);
    src.start(now);

    // Sub-bass rumble oscillators
    [38, 55, 22].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 1.0);
      const og = ctx.createGain();
      og.gain.setValueAtTime(intensity * 0.65, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      chain([osc, og]);
      osc.start(now);
      osc.stop(now + 1.1);
    });
  }

  function playImpact() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    chain([osc, g]);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  function playReload() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    // Metal clank sequence
    [900, 700, 500].forEach((freq, i) => {
      const delay = i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);
      chain([osc, g]);
      osc.start(now + delay);
      osc.stop(now + delay + 0.18);
    });
  }

  function playVictory() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const melody = [523, 659, 784, 659, 784, 1047];
    const timings = [0, 0.17, 0.34, 0.55, 0.7, 0.87];
    const durs    = [0.15, 0.15, 0.18, 0.12, 0.15, 0.5];
    melody.forEach((freq, i) => {
      const t = now + timings[i];
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durs[i]);
      chain([osc, g]);
      osc.start(t);
      osc.stop(t + durs[i] + 0.05);
    });
  }

  return { init, resume, setMuted, playCannonFire, playExplosion, playImpact, playReload, playVictory };
})();
