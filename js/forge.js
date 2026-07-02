/* forge.js — 系统层：熔炉。matter 物理、投放、同级合成、过载判定。engine/world 为模块私有。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const { Engine, Bodies, Composite, Events, Body } = Matter;
  let engine = null, world = null, mergeQueue = [];

  function onCollide(ev) {
    for (const p of ev.pairs) {
      const a = p.bodyA, b = p.bodyB;
      if (a.gTier === undefined || b.gTier === undefined || a.merging || b.merging || a.gTier !== b.gTier || a.gTier >= SF.C.TIERS.length - 1) continue;
      a.merging = b.merging = true; mergeQueue.push([a, b]);
    }
  }
  function processMerges() {
    const G = SF.G, C = SF.C;
    for (const [a, b] of mergeQueue) {
      const nx = (a.position.x + b.position.x) / 2, ny = (a.position.y + b.position.y) / 2, nt = a.gTier + 1;
      Composite.remove(world, a); Composite.remove(world, b); SF.forge.addBall(nt, nx, ny, -1.5);
      G.score += C.VALUE[nt]; G.bestTier = Math.max(G.bestTier, nt);
      SF.fx.burst(nx, ny, C.TIERS[nt].c, 8 + nt);
      if (nt >= 6) SF.fx.addShake(nt * 0.6);
    }
    if (mergeQueue.length) { mergeQueue.length = 0; SF.ui.update(); }
  }
  function checkOverflow(dt) {
    const G = SF.G, C = SF.C;
    for (const b of Composite.allBodies(world)) {
      if (b.gTier === undefined || performance.now() - b.born < 400) continue;
      if (b.position.y - b.circleRadius < C.Y_WARN && b.speed < 1.3) b.overTime += dt; else b.overTime = 0;
      if (b.overTime > C.OVER_LIMIT) {
        G.phase = 'GAMEOVER'; G.over = true; G.current = null;
        SF.ui.update(); SF.ui.setHint('熔炉过载！点击「重新开始」'); return;
      }
    }
  }

  SF.forge = {
    reset() {
      if (world) Composite.clear(world, false);
      engine = Engine.create(); engine.gravity.y = 1.0;
      engine.positionIterations = 10; engine.velocityIterations = 8; world = engine.world;
      const C = SF.C, o = { isStatic: true, restitution: 0.1, friction: 0.4 }, t = 40;
      Composite.add(world, [
        Bodies.rectangle((C.CT.left + C.CT.right) / 2, C.CT.floor + t / 2, (C.CT.right - C.CT.left) + 40, t, o),
        Bodies.rectangle(C.CT.left - t / 2, (C.CT.top + C.CT.floor) / 2, t, (C.CT.floor - C.CT.top) + 200, o),
        Bodies.rectangle(C.CT.right + t / 2, (C.CT.top + C.CT.floor) / 2, t, (C.CT.floor - C.CT.top) + 200, o)
      ]);
      Events.on(engine, 'collisionStart', onCollide);
      mergeQueue = [];
    },
    spawnCurrent() {
      const G = SF.G;
      const t = G.nextTier; G.nextTier = SF.util.pickDropTier();
      G.current = { tier: t, x: SF.C.W / 2 }; G.canDrop = true; SF.ui.update();
    },
    drop() {
      const G = SF.G, C = SF.C;
      if (G.phase !== 'PREP' || !G.current || !G.canDrop || G.over) return;
      const r = C.TIERS[G.current.tier].r;
      this.addBall(G.current.tier, SF.util.clamp(G.current.x, C.CT.left + r + 1, C.CT.right - r - 1), C.Y_DROP, 0.5);
      G.current = null; G.canDrop = false;
      setTimeout(() => { if (!G.over && G.phase === 'PREP') SF.forge.spawnCurrent(); }, 420);
    },
    addBall(tier, x, y, vy) {
      const C = SF.C, r = C.TIERS[tier].r;
      const b = Bodies.circle(x, y, r, { restitution: 0.08, friction: 0.4, frictionStatic: 0.6, density: 0.001, slop: 0.02 });
      b.gTier = tier; b.merging = false; b.overTime = 0; b.born = performance.now();
      if (tier >= C.DEPLOY_MIN) { b.fac = (Math.random() * 4) | 0; b.cls = (Math.random() * 4) | 0; }
      if (vy) Body.setVelocity(b, { x: 0, y: vy });
      Composite.add(world, b); return b;
    },
    removeBody(b) { Composite.remove(world, b); },
    bodies() { return world ? Composite.allBodies(world) : []; },
    deployables() { return this.bodies().filter(b => b.gTier >= SF.C.DEPLOY_MIN); },
    update(dt) { Engine.update(engine, 1000 / 60); processMerges(); checkOverflow(dt); }
  };
})();
