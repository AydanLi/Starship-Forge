/* 核心规则无头回归（M1 基线）。运行:npm test
   覆盖:可播种随机 / 羁绊 2/4 档 / 升星与封顶 / 战术技公式 / 胜利金币 / 广告点位 / 招募 / 存档防篡改与 seed 持久化。 */
import { describe, it, expect, beforeEach } from 'vitest';
import { C, pickDropTier } from '../cocos/assets/scripts/core/config';
import { rng, seedRng, rngSeed } from '../cocos/assets/scripts/core/rng';
import { G, resetG } from '../cocos/assets/scripts/core/state';
import { synergy } from '../cocos/assets/scripts/core/synergy';
import { board } from '../cocos/assets/scripts/core/board';
import { battle } from '../cocos/assets/scripts/core/battle';
import { forge } from '../cocos/assets/scripts/core/forge';
import { econ } from '../cocos/assets/scripts/core/economy';
import { ads } from '../cocos/assets/scripts/core/ads';
import { save } from '../cocos/assets/scripts/core/save';
import { user } from '../cocos/assets/scripts/core/user';
import { menu } from '../cocos/assets/scripts/core/menu';
import { fleet } from '../cocos/assets/scripts/core/fleet';
import { platform } from '../cocos/assets/scripts/core/platform';

beforeEach(() => { resetG(); seedRng(20260707); });

// ---------- 可播种随机 ----------
describe('rng 可播种随机', () => {
  it('同 seed 序列完全一致', () => {
    seedRng(42); const a = [rng.next(), rng.next(), rng.int(100), rng.range(0, 10), rng.chance(0.5)];
    seedRng(42); const b = [rng.next(), rng.next(), rng.int(100), rng.range(0, 10), rng.chance(0.5)];
    expect(a).toEqual(b);
  });
  it('不同 seed 序列不同', () => {
    seedRng(1); const a = [rng.next(), rng.next(), rng.next()];
    seedRng(2); const b = [rng.next(), rng.next(), rng.next()];
    expect(a).not.toEqual(b);
  });
  it('seedRng 返回并记录 seed', () => {
    const s = seedRng(777); expect(s).toBe(777); expect(rngSeed()).toBe(777);
  });
  it('pickDropTier 固定 seed 可复现,且取值都在掉落池内', () => {
    seedRng(9); const a = Array.from({ length: 20 }, () => pickDropTier());
    seedRng(9); const b = Array.from({ length: 20 }, () => pickDropTier());
    expect(a).toEqual(b);
    for (const t of a) expect(C.DROP_POOL).toContain(t);
  });
});

// ---------- 羁绊 ----------
const mk = (fac: number, cls: number, summon = false) => ({ fac, cls, summon });
describe('羁绊 2/4 档', () => {
  it('帝国 ×2 攻击 1.15,×4 攻击 1.35', () => {
    expect(synergy.compute([mk(0, 0), mk(0, 1)]).buffs.atkMul).toBeCloseTo(1.15);
    expect(synergy.compute([mk(0, 0), mk(0, 1), mk(0, 2), mk(0, 3)]).buffs.atkMul).toBeCloseTo(1.35);
  });
  it('异星 ×2 再生,×4 复活', () => {
    const b2 = synergy.compute([mk(1, 0), mk(1, 1)]).buffs;
    expect(b2.regen).toBeCloseTo(0.02); expect(b2.revive).toBe(false);
    expect(synergy.compute([mk(1, 0), mk(1, 1), mk(1, 2), mk(1, 3)]).buffs.revive).toBe(true);
  });
  it('机械 ×2 护盾 10%,×4 护盾 25% + 召唤 2', () => {
    expect(synergy.compute([mk(2, 0), mk(2, 1)]).buffs.shieldPct).toBeCloseTo(0.10);
    const b4 = synergy.compute([mk(2, 0), mk(2, 1), mk(2, 2), mk(2, 3)]).buffs;
    expect(b4.shieldPct).toBeCloseTo(0.25); expect(b4.summonMech).toBe(2);
  });
  it('赛博 ×2 暴击 20%,×4 攻速 1.4', () => {
    const b2 = synergy.compute([mk(3, 0), mk(3, 1)]).buffs;
    expect(b2.crit).toBeCloseTo(0.2); expect(b2.spdMul).toBeCloseTo(1);
    expect(synergy.compute([mk(3, 0), mk(3, 1), mk(3, 2), mk(3, 3)]).buffs.spdMul).toBeCloseTo(1.4);
  });
  it('突击/炮舰/无人机/辅助 舰种档位', () => {
    expect(synergy.compute([mk(0, 0), mk(1, 0)]).buffs.frontRed).toBeCloseTo(0.2);
    expect(synergy.compute([mk(0, 0), mk(1, 0), mk(2, 0), mk(3, 0)]).buffs.frontRed).toBeCloseTo(0.4);
    const gun4 = synergy.compute([mk(0, 1), mk(1, 1), mk(2, 1), mk(3, 1)]).buffs;
    expect(gun4.dmgMul).toBeCloseTo(1.25); expect(gun4.splash).toBe(true);
    expect(synergy.compute([mk(0, 2), mk(1, 2)]).buffs.summonDrone).toBe(1);
    expect(synergy.compute([mk(0, 2), mk(1, 2), mk(2, 2), mk(3, 2)]).buffs.summonDrone).toBe(3);
    expect(synergy.compute([mk(0, 3), mk(1, 3)]).buffs.heal).toBeCloseTo(0.02);
  });
  it('召唤物不计入羁绊', () => {
    const r = synergy.compute([mk(0, 0), mk(0, 1, true)]);
    expect(r.buffs.atkMul).toBeCloseTo(1);
    expect(r.active.length).toBe(0);
  });
});

// ---------- 升星 ----------
const tok = (tier: number, star: number) => ({ tier, fac: 0, cls: 0, star, bodies: [] as any[], x: 0, y: 0 });
describe('编队升星', () => {
  it('同级同星叠放 → 升星', () => {
    const a = tok(5, 1), b = tok(5, 1);
    G.slots[0] = a; Object.assign(a, C.SLOTC[0]);
    G.dragging = { tok: b, ox: 0, oy: 0, fromSlot: null };
    board.dragEnd(C.SLOTC[0].x, C.SLOTC[0].y);
    expect(G.slots[0]).toBe(a); expect(a.star).toBe(2);
  });
  it('3 星封顶:两个 3 星叠放不再升星,改为交换', () => {
    const a = tok(5, 3), b = tok(5, 3);
    G.slots[0] = a; Object.assign(a, C.SLOTC[0]);
    G.dragging = { tok: b, ox: 0, oy: 0, fromSlot: null };
    board.dragEnd(C.SLOTC[0].x, C.SLOTC[0].y);
    expect(a.star).toBe(3); expect(G.slots[0]).toBe(b); expect(G.bench).toContain(a);
  });
  it('不同级叠放 → 交换不升星', () => {
    const a = tok(5, 1), b = tok(6, 1);
    G.slots[0] = a; Object.assign(a, C.SLOTC[0]);
    G.dragging = { tok: b, ox: 0, oy: 0, fromSlot: null };
    board.dragEnd(C.SLOTC[0].x, C.SLOTC[0].y);
    expect(G.slots[0]).toBe(b); expect(a.star).toBe(1); expect(b.star).toBe(1);
  });
  it('星级属性倍率 ×1/×1.8/×3.2', () => {
    const u1 = fleet.unitFromToken(tok(5, 1)), u2 = fleet.unitFromToken(tok(5, 2)), u3 = fleet.unitFromToken(tok(5, 3));
    expect(u2.maxHp).toBe(Math.round(u1.maxHp * 1.8));
    expect(u3.atk).toBe(Math.round(C.B_ATK[5] * 3.2));
  });
});

// ---------- 战斗公式 ----------
describe('战术技与胜利金币', () => {
  function toBattle(level: number, wave: number) {
    G.phase = 'BATTLE'; G.level = level; G.wave = wave;
    G.pBuffs = synergy.compute([]).buffs;
    G.pUnits = [fleet.unitFromToken(tok(5, 1)), fleet.unitFromToken(tok(6, 1))];
    G.eUnits = [fleet.mkEnemy(1000, 10, 1), fleet.mkEnemy(1000, 10, 1)];
    G.tacticalReady = true;
  }
  it('战术技:全队攻击 ×2.4 均分到每个敌人', () => {
    toBattle(0, 0);
    const total = G.pUnits.reduce((s: number, u: any) => s + u.atk, 0);
    const each = Math.round(total * 2.4 / 2);
    battle.tactical();
    for (const e of G.eUnits) expect(e.hp).toBe(1000 - each);
    expect(G.tacticalReady).toBe(false);
    expect(G.tacticalCd).toBe(8);
  });
  it('普通波胜利金币 10+2×星区', () => {
    toBattle(2, 0); user.login('tester');
    for (const e of G.eUnits) { e.hp = 0; e.alive = false; }
    battle.end('win');
    expect(G.lastGain).toBe(10 + 2 * 2);
    expect(G.gold).toBe(G.lastGain);
    expect(G.goldDoubled).toBe(false);
  });
  it('Boss 波胜利金币 30+5×星区', () => {
    toBattle(3, C.WAVES_PER_LEVEL - 1); user.login('tester');
    battle.end('win');
    expect(G.lastGain).toBe(30 + 5 * 3);
  });
  it('失败不发金币', () => {
    toBattle(1, 0); battle.end('lose');
    expect(G.gold).toBe(0); expect(G.result).toBe('lose');
  });
});

// ---------- 广告点位 ----------
describe('广告(3 秒模拟)', () => {
  it('播完才发奖励,且只发一次', () => {
    ads.reset(); let paid = 0;
    ads.show('测试', () => paid++);
    expect(ads.active()).toBe(true);
    ads.update(1.0); expect(paid).toBe(0);
    ads.update(2.5); expect(paid).toBe(1); expect(ads.active()).toBe(false);
    ads.update(5); expect(paid).toBe(1);
  });
  it('播放中重复 show 被忽略', () => {
    ads.reset(); let a = 0, b = 0;
    ads.show('A', () => a++); ads.show('B', () => b++);
    ads.update(4); expect(a).toBe(1); expect(b).toBe(0);
  });
});

// ---------- 经济:刷新与招募 ----------
describe('经济', () => {
  beforeEach(() => { forge.reset(); });
  it('招募:金币足够 → 扣 15 并空降一艘带标签可上阵战舰', () => {
    G.gold = 20; G.phase = 'PREP';
    // 走按钮语义:tryPrepClick 命中第二个按钮(招募援军)
    econ.tryPrepClick(C.CT.left + C.EB_W + 6 + 2, C.EB_Y + 2);
    expect(G.gold).toBe(5);
    const dep = forge.deployables();
    expect(dep.length).toBe(1);
    expect(dep[0].gTier).toBe(C.DEPLOY_MIN);
    expect(dep[0].fac).toBeGreaterThanOrEqual(0); expect(dep[0].fac).toBeLessThan(4);
    expect(dep[0].cls).toBeGreaterThanOrEqual(0); expect(dep[0].cls).toBeLessThan(4);
  });
  it('招募:金币不足 → 不扣钱不出船', () => {
    G.gold = 3; G.phase = 'PREP';
    econ.tryPrepClick(C.CT.left + C.EB_W + 6 + 2, C.EB_Y + 2);
    expect(G.gold).toBe(3);
    expect(forge.deployables().length).toBe(0);
  });
  it('刷新队列:扣 8 金币并重抽当前/下一投放', () => {
    G.gold = 10; G.phase = 'PREP'; G.current = { tier: 0, x: 240 };
    econ.tryPrepClick(C.CT.left + 2, C.EB_Y + 2);
    expect(G.gold).toBe(2);
    expect(C.DROP_POOL).toContain(G.nextTier);
  });
});

// ---------- 存档 ----------
describe('存档与 seed 持久化', () => {
  it('写档→loadProfile 恢复进度与 seed,并重播种', () => {
    user.login('tester');
    G.phase = 'MENU'; G.level = 2; G.wave = 1; G.gold = 88; G.score = 1234; G.bestTier = 7; G.maxLevel = 3;
    G.seed = seedRng(555);
    save.write(true);
    resetG(); G.phase = 'MENU'; seedRng(1);
    menu.loadProfile();
    expect(G.level).toBe(2); expect(G.gold).toBe(88); expect(G.maxLevel).toBe(3);
    expect(G.seed).toBe(555); expect(rngSeed()).toBe(555);
  });
  it('篡改存档 → 校验失败', () => {
    user.login('tester');
    G.phase = 'MENU'; G.gold = 10; save.write(true);
    const key = 'starforge_save_v1:' + user.uid();
    const rec = JSON.parse(platform.getItem(key)!);
    rec.d.gold = 99999;
    platform.setItem(key, JSON.stringify(rec));
    const r = save.load();
    expect(r && (r as any).tampered).toBe(true);
  });
});
