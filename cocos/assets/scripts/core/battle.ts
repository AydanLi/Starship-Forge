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

export const battle = {
  start(): void {
    if (G.phase !== 'DEPLOY') return;
    const placedIdx: number[] = []; G.slots.forEach((t: any, i: number) => { if (t) placedIdx.push(i); });
    if (!placedIdx.length) { flashHint('至少放一艘战舰进阵位再开战'); return; }
    G.pUnits = [];
    // M2 跨波:记录开战阵容快照(失败重试原样还原),每个单位记来源(胜利后回流)
    G.deployedSnapshot = placedIdx.map(i => {
      const t = G.slots[i];
      return { tier: t.tier, fac: t.fac, cls: t.cls, star: t.star };
    });
    placedIdx.forEach(i => {
      const t = G.slots[i];
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
    G.tacticalReady = true; G.tacticalCd = 0; G.battleTime = 0; G.phase = 'BATTLE';
    audio.play('battle'); uiDirty();
    setHint('自动战斗中… 羁绊已生效，必要时放「战术技」');
  },
  tactical(): void {
    if (G.phase !== 'BATTLE' || !G.tacticalReady) return;
    const total = G.pUnits.filter((u: any) => u.alive).reduce((s: number, u: any) => s + u.atk, 0);
    const foes = G.eUnits.filter((f: any) => f.alive);
    const each = Math.round(total * 2.4 / Math.max(1, foes.length));
    for (const f of foes) hit(f, each);
    for (let i = 0; i < 10; i++) fx.addBeam({ x1: rand(C.CT.left, C.CT.right), y1: 620, x2: rand(C.CT.left, C.CT.right), y2: 200, life: 0.7, c: '#ff2e88' });
    fx.setShake(10); audio.play('tactical'); G.tacticalReady = false; G.tacticalCd = 8; uiDirty();
  },
  update(dt: number): void {
    if (G.phase !== 'BATTLE') return;
    if (G.tacticalCd > 0) { G.tacticalCd -= dt; if (G.tacticalCd <= 0) { G.tacticalCd = 0; G.tacticalReady = true; uiDirty(); } }
    for (const u of G.pUnits.concat(G.eUnits)) {
      if (!u.alive) continue;
      u.timer += dt; if (u.timer >= 1 / u.spd) { u.timer = 0; doAttack(u); }
      if (u.team === 'p' && G.pBuffs && G.pBuffs.regen) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * G.pBuffs.regen * dt);
    }
    if (G.pBuffs && G.pBuffs.heal) { const a = G.pUnits.filter((u: any) => u.alive); if (a.length) { a.sort((x: any, y: any) => x.hp / x.maxHp - y.hp / y.maxHp); a[0].hp = Math.min(a[0].maxHp, a[0].hp + a[0].maxHp * G.pBuffs.heal * dt); } }
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
      // M2 跨波刚体回流:存活者返航入坞;阵亡者残骸回收;船坞超限折价
      let salvage = 0, lost = 0, returned = 0;
      for (const u of G.pUnits) {
        if (!u.src || u.summon) continue;
        if (!u.alive) { lost++; salvage += Math.round(C.VALUE[u.src.tier] * C.STAR_MUL[u.src.star] * C.SALVAGE_RATE); }
        else if (returned < C.DOCK_CAP) { forge.returnShip(u.src.tier, u.src.fac, u.src.cls, u.src.star); returned++; }
        else salvage += Math.round(C.VALUE[u.src.tier] * C.STAR_MUL[u.src.star] * C.DOCK_OVER_RATE);
      }
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
