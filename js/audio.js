/* audio.js — 服务层：程序化合成音效（Web Audio API，零音频文件）。
   浏览器策略：首次用户交互后才允许出声，本模块自动在首次 pointerdown 解锁。
   正式版可整体替换为真实音频文件（Cocos AudioSource / tt 音频接口），调用点不变。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  let ctx = null, master = null, muted = false, lastShot = 0;
  try { muted = localStorage.getItem('starforge_muted') === '1'; } catch (e) {}

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    return true;
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }

  function env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + a + d);
  }
  function beep(freq, dur, type, peak, slideTo, delay) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    env(g, t0, 0.005, dur, peak || 0.15);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, peak, cutoff, delay) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 900;
    const g = ctx.createGain(); env(g, t0, 0.005, dur, peak || 0.2);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0);
  }

  const sfx = {
    drop() { beep(320, 0.07, 'sine', 0.10, 220); },
    // 合成音随等级变厚重；高级合成加锯齿泛音+噪声冲击
    merge(tier) {
      const f = 240 + tier * 46;
      beep(f, 0.10, 'triangle', 0.16);
      beep(f * 1.5, 0.12, 'triangle', 0.14, null, 0.06);
      if (tier >= 8) { beep(f * 2, 0.18, 'sawtooth', 0.10, null, 0.12); noise(0.15, 0.06, 1200, 0.05); }
    },
    star() { [660, 880, 1320].forEach((f, i) => beep(f, 0.12, 'triangle', 0.16, null, i * 0.07)); },
    deploy() { beep(180, 0.22, 'sawtooth', 0.10, 420); },
    battle() { beep(160, 0.18, 'square', 0.10); beep(160, 0.18, 'square', 0.10, null, 0.22); },
    shot() { const now = performance.now(); if (now - lastShot < 50) return; lastShot = now; beep(900, 0.05, 'square', 0.04, 300); },   // 全局节流50ms
    explode() { noise(0.28, 0.22, 800); beep(90, 0.25, 'sine', 0.12, 40); },
    bossdown() { noise(0.6, 0.3, 500); beep(60, 0.5, 'sine', 0.18, 35); },
    win() { [523, 659, 784].forEach((f, i) => beep(f, 0.14, 'triangle', 0.15, null, i * 0.09)); },
    lose() { [392, 311, 233].forEach((f, i) => beep(f, 0.22, 'sine', 0.14, null, i * 0.16)); },
    tactical() { beep(1400, 0.35, 'sawtooth', 0.12, 180); noise(0.3, 0.15, 2000, 0.05); },
    coin() { beep(1320, 0.07, 'triangle', 0.16); beep(1760, 0.09, 'triangle', 0.14, null, 0.07); },
    deny() { beep(130, 0.16, 'square', 0.10, 90); },
    card() { beep(520, 0.08, 'sine', 0.10, 700); },
    overload() { beep(420, 0.7, 'sawtooth', 0.16, 70); noise(0.5, 0.12, 500, 0.1); }
  };

  SF.audio = {
    play(name, arg) { if (muted || !ctx) return; const f = sfx[name]; if (f) { try { f(arg); } catch (e) {} } },
    unlock,
    ready() { return ctx ? ctx.state : 'none'; },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('starforge_muted', muted ? '1' : '0'); } catch (e) {}
      const b = document.getElementById('mute'); if (b) b.textContent = muted ? '🔇' : '🔊';
      if (!muted) unlock();
    }
  };

  window.addEventListener('pointerdown', unlock);
  const mb = document.getElementById('mute');
  if (mb) { mb.textContent = muted ? '🔇' : '🔊'; mb.addEventListener('click', () => SF.audio.toggle()); }
})();
