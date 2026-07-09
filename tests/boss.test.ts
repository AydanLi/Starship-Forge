/* M4 Boss 机制回归:五机制(summon/shield/hatch/silence/snipe)+ 预警 + 沉默按钮态。
   驱动方式:布阵开战后把双方攻速压到 0(排除普攻干扰),逐步推进 battle.update 观察技能状态机。 */
import { describe, it, expect, beforeEach } from 'vitest';
import { C } from '../cocos/assets/scripts/core/config';
import { seedRng } from '../cocos/assets/scripts/core/rng';
import { G, resetG } from '../cocos/assets/scripts/core/state';
import { forge } from '../cocos/assets/scripts/core/forge';
import { battle } from '../cocos/assets/scripts/core/battle';
import { user } from '../cocos/assets/scripts/core/user';
import * as flow from '../cocos/assets/scripts/core/flow';

const tok = (tier: number, star: number, fac: number, cls: number) =>
  ({ tier, fac, cls, star, bodies: [] as any[], x: 0, y: 0 });

/** 进入指定星区的 Boss 波并冻结普攻(只留技能状态机在跑) */
function bossFight(level: number, tokens: any[] = [tok(6, 1, 0, 1), tok(6, 1, 1, 2)]): any {
  G.phase = 'DEPLOY'; G.level = level; G.wave = C.WAVES_PER_LEVEL - 1;
  G.slots = [null, null, null, null, null, null];
  tokens.forEach((t, i) => { G.slots[i] = t; });
  battle.start();
  expect(G.phase).toBe('BATTLE');
  for (const u of G.pUnits.concat(G.eUnits)) { u.spd = 1e-6; }   // 冻结普攻
  const boss = G.eUnits.find((u: any) => u.isBoss);
  expect(boss).toBeTruthy();
  return boss;
}
function step(sec: number): void {
  const n = Math.round(sec / 0.05);
  for (let i = 0; i < n && G.phase === 'BATTLE'; i++) battle.update(0.05);
}

beforeEach(() => { resetG(); seedRng(20260712); forge.reset(); user.login('tester'); });

describe('通用状态机与预警', () => {
  it('周期技先预警 BOSS_WARN 秒再施放(黄圈标记 warnOn)', () => {
    const boss = bossFight(1);                       // S2 铁卫:interval 8
    const sk = C.BOSS_SKILLS[1];
    step(sk.interval - C.BOSS_WARN + 0.1);
    expect(boss.warnOn).toBe(true);                  // 预警中
    expect(boss.shield || 0).toBe(0);                // 还没施放
    step(C.BOSS_WARN + 0.1);
    expect(boss.warnOn).toBe(false);
    expect(boss.shield).toBe(sk.value);              // 施放完成
  });
});

describe('S1 秃鹫号 · 半血召唤(一次性)', () => {
  it('血量降至阈值以下 → 预警后召唤 count 个护卫,且只触发一次', () => {
    const boss = bossFight(0);
    const before = G.eUnits.length;
    step(3); expect(G.eUnits.length).toBe(before);   // 满血不触发
    boss.hp = boss.maxHp * C.BOSS_SKILLS[0].threshold - 1;
    step(C.BOSS_WARN + 0.2);
    expect(G.eUnits.length).toBe(before + C.BOSS_SKILLS[0].count);
    for (const m of G.eUnits.slice(before)) { m.spd = 1e-6; }
    step(5);                                          // 血量仍低,不重复触发
    expect(G.eUnits.length).toBe(before + C.BOSS_SKILLS[0].count);
  });
});

describe('S3 虫族女皇 · 周期孵化', () => {
  it('每 interval 秒孵化 count 个弱化虫(两轮翻倍)', () => {
    bossFight(2);
    const sk = C.BOSS_SKILLS[2];
    const base = G.eUnits.length;
    step(sk.interval + 0.2);
    expect(G.eUnits.length).toBe(base + sk.count);
    for (const m of G.eUnits.slice(base)) { m.spd = 1e-6; }
    const hatchling = G.eUnits[G.eUnits.length - 1];
    expect(hatchling.maxHp).toBeLessThan(C.ENEMY.minHp * (1 + C.ENEMY.minLv * 2));   // 弱化体
    step(sk.interval + 0.2);
    expect(G.eUnits.length).toBe(base + sk.count * 2);
  });
});

describe('S4 零号意志 · 信号压制', () => {
  it('施放后锁定战术技 duration 秒:按钮变压制态,tactical() 无效,到时解锁', () => {
    bossFight(3);
    const sk = C.BOSS_SKILLS[3];
    step(sk.interval + 0.2);
    expect(G.tacticalLocked).toBeGreaterThan(0);
    expect(flow.uiModel().fire).toContain('压制');
    expect(flow.uiModel().fireOn).toBe(false);
    const hpBefore = G.eUnits.map((u: any) => u.hp);
    battle.tactical();                                // 被压制:无效
    expect(G.eUnits.map((u: any) => u.hp)).toEqual(hpBefore);
    expect(G.tacticalReady).toBe(true);               // 技能没被消耗
    step(sk.duration + 0.2);
    expect(G.tacticalLocked).toBe(0);
    expect(flow.uiModel().fire).toContain('战术技');
  });
});

describe('S5 万王之王 · 点名前排', () => {
  it('每 interval 秒对我方前排打 atk×mult(无羁绊减免时足额)', () => {
    const boss = bossFight(4);
    const sk = C.BOSS_SKILLS[4];
    const frontHp = G.pUnits.filter((u: any) => u.front).map((u: any) => u.hp);
    step(sk.interval + 0.2);
    const after = G.pUnits.filter((u: any) => u.front).map((u: any) => u.hp);
    const dmg = frontHp.reduce((s, v) => s + v, 0) - after.reduce((s, v) => s + v, 0);
    expect(dmg).toBe(Math.round(boss.atk * sk.mult));
  });
});

describe('与既有规则的兼容', () => {
  it('25 秒超时判定仍生效(机制不卡死战斗)', () => {
    bossFight(1);
    step(26);
    expect(G.phase).toBe('RESULT');                   // 按血量比例判了胜负
  });
  it('普通波(非 Boss)完全不受机制影响', () => {
    G.phase = 'DEPLOY'; G.level = 3; G.wave = 0;
    G.slots = [null, null, null, null, null, null];
    G.slots[0] = tok(6, 1, 0, 1);
    battle.start();
    for (const u of G.pUnits.concat(G.eUnits)) u.spd = 1e-6;
    step(12);
    expect(G.tacticalLocked).toBe(0);
    expect(G.eUnits.every((u: any) => !u.isBoss)).toBe(true);
  });
});
