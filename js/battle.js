/* battle.js — 系统层：自走棋自动战斗。开战/寻敌/结算/战术技/胜负。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const { rand } = SF.util;

  function enemyOf(u) { const G = SF.G; return u.team === 'p' ? G.eUnits : G.pUnits; }
  function pickTarget(u) {
    const f = enemyOf(u).filter(x => x.alive); if (!f.length) return null;
    const fr = f.filter(x => x.front); const pool = fr.length ? fr : f;
    return pool[(Math.random() * pool.length) | 0];
  }
  function doAttack(u) {
    const G = SF.G;
    const t = pickTarget(u); if (!t) return;
    const crit = u.team === 'p' && Math.random() < G.pBuffs.crit; let dmg = u.atk * (crit ? 1.5 : 1);
    hit(t, dmg); addBeam(u, t, crit);
    if (u.team === 'p' && G.pBuffs.splash) { const o = G.eUnits.filter(x => x.alive && x !== t); if (o.length) hit(o[(Math.random() * o.length) | 0], dmg * 0.5); }
  }
  function hit(t, dmg) {
    const G = SF.G;
    if (t.front && t.team === 'p' && G.pBuffs) dmg *= (1 - G.pBuffs.frontRed);
    dmg = Math.round(dmg);
    if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
    t.hp -= dmg;
    SF.fx.addFloat({ x: t.x + rand(-6, 6), y: t.y - 14, t: '-' + Math.max(1, dmg), life: 0.9, color: t.team === 'e' ? '#ffe08a' : '#ff9db0', sz: 13 });
    if (t.hp <= 0) {
      if (t.team === 'p' && G.pBuffs && G.pBuffs.revive && !t.revived) { t.revived = true; t.hp = t.maxHp * 0.5; }
      else { t.alive = false; SF.fx.burst(t.x, t.y, t.team === 'e' ? '#ff6a6a' : '#8fd8ff', 12); }
    }
  }
  function addBeam(u, t, crit) {
    SF.fx.addBeam({ x1: u.x, y1: u.y, x2: t.x, y2: t.y, life: 0.9, c: u.team === 'p' ? (crit ? '#fff2a0' : '#7cf3ff') : '#ff6a6a' });
  }
  function frac(arr) { const m = arr.reduce((s, u) => s + u.maxHp, 0); return m ? arr.reduce((s, u) => s + Math.max(0, u.hp), 0) / m : 0; }

  SF.battle = {
    start() {
      const G = SF.G, C = SF.C;
      if (G.phase !== 'DEPLOY') return;
      const placedIdx = []; G.slots.forEach((t, i) => { if (t) placedIdx.push(i); });
      if (!placedIdx.length) { SF.ui.flashHint('至少放一艘战舰进阵位再开战'); return; }
      G.pUnits = [];
      placedIdx.forEach(i => {
        const u = SF.fleet.unitFromToken(G.slots[i]); u.front = i < 3;
        for (const b of G.slots[i].bodies) SF.forge.removeBody(b);
        G.pUnits.push(u);
      });
      const s = SF.synergy.compute(G.pUnits); G.pBuffs = s.buffs; G.pSyn = s.active;
      SF.synergy.applyBuffs(G.pUnits, G.pBuffs);
      if (G.overloadBoost) { for (const u of G.pUnits) u.atk = Math.round(u.atk * 1.5); G.overloadBoost = false; SF.ui.flashHint('⚡ 旗舰超载生效：全队攻击 +50%！'); }
      for (let i = 0; i < G.pBuffs.summonMech; i++) G.pUnits.push(SF.fleet.mkSummon('mech'));
      for (let i = 0; i < G.pBuffs.summonDrone; i++) G.pUnits.push(SF.fleet.mkSummon('drone'));
      G.eUnits = SF.fleet.genEnemies(G.level, G.wave);
      SF.fleet.layout(G.pUnits, false, true); SF.fleet.layout(G.eUnits, true, false);
      G.slots = [null, null, null, null, null, null]; G.bench = [];
      G.tacticalReady = true; G.tacticalCd = 0; G.battleTime = 0; G.phase = 'BATTLE'; SF.ui.update();
      SF.ui.setHint('自动战斗中… 羁绊已生效，必要时放「战术技」');
    },
    tactical() {
      const G = SF.G, C = SF.C;
      if (G.phase !== 'BATTLE' || !G.tacticalReady) return;
      const total = G.pUnits.filter(u => u.alive).reduce((s, u) => s + u.atk, 0), foes = G.eUnits.filter(f => f.alive);
      const each = Math.round(total * 2.4 / Math.max(1, foes.length));
      for (const f of foes) hit(f, each);
      for (let i = 0; i < 10; i++) SF.fx.addBeam({ x1: rand(C.CT.left, C.CT.right), y1: 620, x2: rand(C.CT.left, C.CT.right), y2: 200, life: 0.7, c: '#ff2e88' });
      SF.fx.setShake(10); G.tacticalReady = false; G.tacticalCd = 8; SF.ui.update();
    },
    update(dt) {
      const G = SF.G;
      if (G.phase !== 'BATTLE') return;
      if (G.tacticalCd > 0) { G.tacticalCd -= dt; if (G.tacticalCd <= 0) { G.tacticalCd = 0; G.tacticalReady = true; SF.ui.update(); } }
      for (const u of G.pUnits.concat(G.eUnits)) {
        if (!u.alive) continue;
        u.timer += dt; if (u.timer >= 1 / u.spd) { u.timer = 0; doAttack(u); }
        if (u.team === 'p' && G.pBuffs && G.pBuffs.regen) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * G.pBuffs.regen * dt);
      }
      if (G.pBuffs && G.pBuffs.heal) { const a = G.pUnits.filter(u => u.alive); if (a.length) { a.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp); a[0].hp = Math.min(a[0].maxHp, a[0].hp + a[0].maxHp * G.pBuffs.heal * dt); } }
      G.battleTime += dt;
      if (!G.eUnits.some(u => u.alive)) this.end('win');
      else if (!G.pUnits.some(u => u.alive)) this.end('lose');
      else if (G.battleTime > 25) { this.end(frac(G.pUnits) >= frac(G.eUnits) ? 'win' : 'lose'); }   // 超时按血量比
    },
    end(r) {
      const G = SF.G, C = SF.C;
      if (G.phase !== 'BATTLE') return;
      G.result = r; G.phase = 'RESULT';
      if (r === 'win') {
        const boss = G.wave === C.WAVES_PER_LEVEL - 1;
        G.lastGain = boss ? 30 + G.level * 5 : 10 + G.level * 2;
        G.gold += G.lastGain; G.goldDoubled = false;
        SF.ui.setHint('胜利！可看广告双倍金币，或点「' + (boss ? '进入下一星区' : '下一波') + '」');
        SF.save.write(true);
      } else SF.ui.setHint('舰队覆灭——可看广告「旗舰超载」加成重打，或直接重试');
      SF.ui.update();
    }
  };
})();
