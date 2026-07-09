/* battle.ts — 自走棋自动战斗（与 js/battle.js 一致）。 */
import { C, rand } from './config';
import { rng } from './rng';
import { G, setHint, flashHint } from './state';
import { forge } from './forge';
import { fleet } from './fleet';
import { synergy } from './synergy';
import { fx } from './fx';
import { audio } from './audio';
import { save } from './save';

let uiDirty = () => {};
export function bindUiDirty(f: () => void) { uiDirty = f; }

function enemyOf(u: any): any[] { return u.team === 'p' ? G.eUnits : G.pUnits; }
function pickTarget(u: any): any {
  const f = enemyOf(u).filter((x: any) => x.alive); if (!f.length) return null;
  const fr = f.filter((x: any) => x.front); const pool = fr.length ? fr : f;
  return rng.pick(pool);
}
function doAttack(u: any): void {
  const t = pickTarget(u); if (!t) return;
  const crit = u.team === 'p' && rng.chance(G.pBuffs.crit); let dmg = u.atk * (crit ? 1.5 : 1);
  hit(t, dmg); addBeam(u, t, crit); audio.play('shot');
  if (u.team === 'p' && G.pBuffs.splash) { const o = G.eUnits.filter((x: any) => x.alive && x !== t); if (o.length) hit(rng.pick(o), dmg * 0.5); }
}
function hit(t: any, dmg: number): void {
  if (t.front && t.team === 'p' && G.pBuffs) dmg *= (1 - G.pBuffs.frontRed);
  dmg = Math.round(dmg);
  if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
  t.hp -= dmg;
  fx.addFloat({ x: t.x + rand(-6, 6), y: t.y - 14, t: '-' + Math.max(1, dmg), life: 0.9, color: t.team === 'e' ? '#ffe08a' : '#ff9db0', sz: 13 });
  if (t.hp <= 0) {
    if (t.team === 'p' && G.pBuffs && G.pBuffs.revive && !t.revived) { t.revived = true; t.hp = t.maxHp * 0.5; }
    else { t.alive = false; fx.burst(t.x, t.y, t.team === 'e' ? '#ff6a6a' : '#8fd8ff', 12); audio.play(t.isBoss ? 'bossdown' : 'explode'); }
  }
}
function addBeam(u: any, t: any, crit: boolean): void {
  fx.addBeam({ x1: u.x, y1: u.y, x2: t.x, y2: t.y, life: 0.9, c: u.team === 'p' ? (crit ? '#fff2a0' : '#7cf3ff') : '#ff6a6a' });
}
function frac(arr: any[]): number { const m = arr.reduce((s, u) => s + u.maxHp, 0); return m ? arr.reduce((s, u) => s + Math.max(0, u.hp), 0) / m : 0; }

/* ================= M4 Boss 机制(数据驱动,config.BOSS_SKILLS) =================
   通用状态机:计时 → 预警 C.BOSS_WARN 秒(黄圈闪烁+飘字+音效) → 施放。
   五个机制全部围绕「战术技何时按」:留技清场/破盾窗口/攒队清潮/压制抢拍/抢在斩杀前爆发。 */
function beginWarn(boss: any, sk: any): void {
  boss.warnOn = true; boss.warnT = C.BOSS_WARN;
  fx.addFloat({ x: boss.x, y: boss.y - 70, t: '⚠ ' + (sk.warn || sk.type), life: 1.4, color: '#ffd54a', sz: 15 });
  audio.play('card');
}
function castBossSkill(boss: any, sk: any): void {
  boss.warnOn = false; boss.warnT = 0; boss.skT = 0;
  const E = C.ENEMY, lv = G.level;
  switch (sk.type) {
    case 'summon':     // 一次性召唤满编护卫
    case 'hatch': {    // 周期孵化弱化虫群
      const weak = sk.type === 'hatch' ? 0.55 : 1;
      for (let i = 0; i < sk.count; i++) {
        const m = fleet.mkEnemy(E.minHp * (1 + E.minLv * lv) * weak, E.minAtk * (1 + E.minLv * lv) * weak, 1.15);
        m.front = true;
        G.eUnits.push(m);
      }
      fleet.layout(G.eUnits, true, true);
      fx.burst(boss.x, boss.y + 50, sk.type === 'hatch' ? '#ff2e5b' : '#ff6a6a', 16);
      audio.play('deploy');
      break;
    }
    case 'shield':
      boss.shield = (boss.shield || 0) + sk.value;
      fx.burst(boss.x, boss.y, '#7cf3ff', 18);
      audio.play('star');
      break;
    case 'silence':
      G.tacticalLocked = sk.duration;
      flashHint('⚠ ' + (boss.name || 'Boss') + ' 压制了战术技链路 ' + sk.duration + ' 秒！');
      fx.addFloat({ x: C.W / 2, y: 620, t: '⚠ 战术技被压制', life: 1.6, color: '#ff8a9c', sz: 16 });
      audio.play('deny');
      break;
    case 'snipe': {
      const front = G.pUnits.filter((u: any) => u.alive && u.front);
      const pool = front.length ? front : G.pUnits.filter((u: any) => u.alive);
      if (!pool.length) break;
      const t = rng.pick(pool);
      fx.addBeam({ x1: boss.x, y1: boss.y, x2: t.x, y2: t.y, life: 1.1, c: '#ffd54a' });
      hit(t, boss.atk * sk.mult);
      fx.setShake(8);
      audio.play('explode');
      break;
    }
  }
}
function updateBossSkill(dt: number): void {
  const boss = G.eUnits.find((u: any) => u.alive && u.isBoss);
  if (!boss) return;
  const sk = C.BOSS_SKILLS[Math.min(G.level, C.BOSS_SKILLS.length - 1)];
  if (!sk) return;
  if (boss.warnOn) {                                  // 预警中 → 到点施放
    boss.warnT -= dt;
    if (boss.warnT <= 0) castBossSkill(boss, sk);
    return;
  }
  if (sk.type === 'summon') {                          // 血量阈值型:一次性
    if (!boss.skillUsed && boss.hp <= boss.maxHp * sk.threshold) { boss.skillUsed = true; beginWarn(boss, sk); }
    return;
  }
  boss.skT = (boss.skT || 0) + dt;                     // 周期型
  if (boss.skT >= sk.interval - C.BOSS_WARN) beginWarn(boss, sk);
}

/** 胜利结算(P1 抽取):存活回流 / 阵亡残骸 / 船坞超限折价。纯状态操作,返回统计。 */
function settleWin(): { returned: number, lost: number, salvage: number } {
  let salvage = 0, lost = 0, returned = 0;
  for (const u of G.pUnits) {
    if (!u.src || u.summon) continue;
    if (!u.alive) { lost++; salvage += Math.round(C.VALUE[u.src.tier] * C.STAR_MUL[u.src.star] * C.SALVAGE_RATE); }
    else if (returned < C.DOCK_CAP) { forge.returnShip(u.src.tier, u.src.fac, u.src.cls, u.src.star); returned++; }
    else salvage += Math.round(C.VALUE[u.src.tier] * C.STAR_MUL[u.src.star] * C.DOCK_OVER_RATE);
  }
  return { returned, lost, salvage };
}

export const battle = {
  start(): void {
    if (G.phase !== 'DEPLOY') return;
    const placedIdx: number[] = []; G.slots.forEach((t: any, i: number) => { if (t) placedIdx.push(i); });
    if (!placedIdx.length) { flashHint('至少放一艘战舰进阵位再开战'); return; }
    G.pUnits = [];
    // M2 跨波:记录开战阵容快照(失败重试原样还原),每个单位记来源(胜利后回流)
    G.deployedSnapshot = placedIdx.map(i => {
      const t = G.slots[i]!;   // placedIdx 只收集了非空槽位
      return { tier: t.tier, fac: t.fac, cls: t.cls, star: t.star };
    });
    placedIdx.forEach(i => {
      const t = G.slots[i]!;
      const u = fleet.unitFromToken(t); u.front = i < 3;
      u.src = { tier: t.tier, fac: t.fac, cls: t.cls, star: t.star };
      for (const b of t.bodies) forge.removeBody(b);
      G.pUnits.push(u);
    });
    const s = synergy.compute(G.pUnits); G.pBuffs = s.buffs; G.pSyn = s.active;
    synergy.applyBuffs(G.pUnits, G.pBuffs);
    if (G.overloadBoost) { for (const u of G.pUnits) u.atk = Math.round(u.atk * 1.5); G.overloadBoost = false; flashHint('⚡ 旗舰超载生效：全队攻击 +50%！'); }
    for (let i = 0; i < G.pBuffs.summonMech; i++) G.pUnits.push(fleet.mkSummon('mech'));
    for (let i = 0; i < G.pBuffs.summonDrone; i++) G.pUnits.push(fleet.mkSummon('drone'));
    G.eUnits = fleet.genEnemies(G.level, G.wave);
    fleet.layout(G.pUnits, false, true); fleet.layout(G.eUnits, true, false);
    G.slots = [null, null, null, null, null, null]; G.bench = [];
    const bs = G.eUnits.find((u: any) => u.isBoss);
    if (bs) { bs.skT = 0; bs.warnT = 0; bs.warnOn = false; bs.skillUsed = false; }
    G.tacticalReady = true; G.tacticalCd = 0; G.tacticalLocked = 0; G.battleTime = 0; G.phase = 'BATTLE';
    audio.play('battle'); uiDirty();
    setHint('自动战斗中… 羁绊已生效，必要时放「战术技」');
  },
  tactical(): void {
    if (G.phase !== 'BATTLE' || !G.tacticalReady || G.tacticalLocked > 0) return;   // M4:被压制时不可释放
    const total = G.pUnits.filter((u: any) => u.alive).reduce((s: number, u: any) => s + u.atk, 0);
    const foes = G.eUnits.filter((f: any) => f.alive);
    const each = Math.round(total * 2.4 / Math.max(1, foes.length));
    for (const f of foes) hit(f, each);
    for (let i = 0; i < 10; i++) fx.addBeam({ x1: rand(C.CT.left, C.CT.right), y1: 620, x2: rand(C.CT.left, C.CT.right), y2: 200, life: 0.7, c: '#ff2e88' });
    fx.setShake(10); audio.play('tactical'); G.tacticalReady = false; G.tacticalCd = 8; uiDirty();
  },
  update(dt: number): void {
    if (G.phase !== 'BATTLE') return;
    if (G.tacticalLocked > 0) { G.tacticalLocked -= dt; if (G.tacticalLocked <= 0) { G.tacticalLocked = 0; uiDirty(); } }
    if (G.tacticalCd > 0) { G.tacticalCd -= dt; if (G.tacticalCd <= 0) { G.tacticalCd = 0; G.tacticalReady = true; uiDirty(); } }
    for (const u of G.pUnits.concat(G.eUnits)) {
      if (!u.alive) continue;
      u.timer += dt; if (u.timer >= 1 / u.spd) { u.timer = 0; doAttack(u); }
      if (u.team === 'p' && G.pBuffs && G.pBuffs.regen) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * G.pBuffs.regen * dt);
    }
    if (G.pBuffs && G.pBuffs.heal) { const a = G.pUnits.filter((u: any) => u.alive); if (a.length) { a.sort((x: any, y: any) => x.hp / x.maxHp - y.hp / y.maxHp); a[0].hp = Math.min(a[0].maxHp, a[0].hp + a[0].maxHp * G.pBuffs.heal * dt); } }
    updateBossSkill(dt);   // M4:Boss 机制步进(预警→施放)
    G.battleTime += dt;
    if (!G.eUnits.some((u: any) => u.alive)) this.end('win');
    else if (!G.pUnits.some((u: any) => u.alive)) this.end('lose');
    else if (G.battleTime > 25) { this.end(frac(G.pUnits) >= frac(G.eUnits) ? 'win' : 'lose'); }
  },
  end(r: string): void {
    if (G.phase !== 'BATTLE') return;
    G.result = r; G.phase = 'RESULT';
    audio.play(r === 'win' ? 'win' : 'lose');
    if (r === 'win') {
      // M2 跨波刚体回流(P1:结算逻辑抽至 settleWin)
      const { returned, lost, salvage } = settleWin();
      G.lastSalvage = salvage; G.lastLost = lost; G.lastReturned = returned;
      G.deployedSnapshot = null;
      const boss = G.wave === C.WAVES_PER_LEVEL - 1;
      G.lastGain = boss ? 30 + G.level * 5 : 10 + G.level * 2;
      G.gold += G.lastGain + salvage; G.goldDoubled = false;
      setHint('胜利！舰队返航 ' + returned + ' 艘' + (lost ? '，损失 ' + lost + ' 艘（残骸回收 +' + salvage + '💰）' : '') + '，可看广告双倍金币');
      save.write(true);
    } else setHint('舰队覆灭——重试不结算损耗，舰队将原样回炉；也可看广告「旗舰超载」加成重打');
    uiDirty();
  }
};
