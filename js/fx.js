/* fx.js — 服务层：粒子/光束/飘字/屏震 特效池。自持状态，供系统层调用、render 绘制。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const { rand, clamp } = SF.util;
  let particles = [], beams = [], floats = [], shake = 0;

  SF.fx = {
    burst(x, y, color, n) {
      for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(1, 5); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, r: rand(2, 4) }); }
    },
    addBeam(b) { beams.push(b); },
    addFloat(f) { floats.push(f); },
    addShake(v) { shake = Math.min(shake + v, 10); },
    setShake(v) { shake = v; },
    shakeOffset() {
      if (shake > 0.2) { const sx = rand(-shake, shake), sy = rand(-shake, shake); shake *= 0.85; return { sx, sy }; }
      shake = 0; return { sx: 0, sy: 0 };
    },
    update(dt) {
      for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt * 1.6; }
      particles = particles.filter(p => p.life > 0);
      for (const b of beams) b.life -= dt * 2.2; beams = beams.filter(b => b.life > 0);
      for (const f of floats) { f.y -= 14 * dt; f.life -= dt * 0.9; } floats = floats.filter(f => f.life > 0);
    },
    clear() { particles = []; beams = []; floats = []; shake = 0; },
    draw(ctx) {
      for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const b of beams) { ctx.globalAlpha = Math.max(0, b.life) * 0.85; ctx.strokeStyle = b.c; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const f of floats) { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.font = 'bold ' + f.sz + 'px sans-serif'; ctx.fillText(f.t, f.x, f.y); }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
  };
})();
