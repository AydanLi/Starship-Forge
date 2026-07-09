/* M3 构筑可控回归:软权重 / 三选一定向招募(缺口保底、选卡扣费、取消免费、广告入口)。 */
import { describe, it, expect, beforeEach } from 'vitest';
import { C } from '../cocos/assets/scripts/core/config';
import { rng, seedRng } from '../cocos/assets/scripts/core/rng';
import { G, resetG } from '../cocos/assets/scripts/core/state';
import { forge } from '../cocos/assets/scripts/core/forge';
import { econ } from '../cocos/assets/scripts/core/economy';
import { ads } from '../cocos/assets/scripts/core/ads';
import { user } from '../cocos/assets/scripts/core/user';
import * as flow from '../cocos/assets/scripts/core/flow';

const card = (i: number) => [C.RC.CARDS[i].x + 5, C.RC.CARDS[i].y + 5] as [number, number];

beforeEach(() => { resetG(); seedRng(20260710); forge.reset(); ads.reset(); user.login('tester'); G.phase = 'PREP'; });

describe('软权重(pickTag)', () => {
  function dist(n: number): number {
    let hit = 0;
    for (let i = 0; i < n; i++) if (forge.pickTag('fac') === 0) hit++;
    return hit / n;
  }
  it('拥有 ≥SOFT_MIN 个同阵营时,该阵营权重上升', () => {
    for (let i = 0; i < 3; i++) forge.addBall(5, 100 + i * 60, 300, 0, 0, i);   // 3 艘帝国
    const p = dist(2000);
    expect(p).toBeGreaterThan(0.34);          // 2/(2+3)=0.4 理论值,留余量
    expect(p).toBeLessThan(0.47);
  });
  it('SOFT_W=1 退化为纯随机', () => {
    const w = C.SOFT_W;
    (C as any).SOFT_W = 1;
    try {
      for (let i = 0; i < 3; i++) forge.addBall(5, 100 + i * 60, 300, 0, 0, i);
      const p = dist(2000);
      expect(p).toBeGreaterThan(0.20); expect(p).toBeLessThan(0.30);
    } finally { (C as any).SOFT_W = w; }
  });
  it('空炉时四类均匀', () => {
    const p = dist(2000);
    expect(p).toBeGreaterThan(0.20); expect(p).toBeLessThan(0.30);
  });
});

describe('三选一定向招募', () => {
  it('金币足够点「定向招募」→ 打开面板出 3 张候选', () => {
    G.gold = 20;
    econ.tryPrepClick(C.CT.left + C.EB_W + 6 + 2, C.EB_Y + 2);
    expect(G.panel).toBe('recruit');
    expect(G.recruitOffers!.length).toBe(3);
    expect(G.recruitFree).toBe(false);
    expect(G.gold).toBe(20);                                   // 开面板不扣费
    for (const o of G.recruitOffers!) {
      expect([C.DEPLOY_MIN, C.DEPLOY_MIN + 1]).toContain(o.tier);
      expect(o.fac).toBeGreaterThanOrEqual(0); expect(o.fac).toBeLessThan(4);
    }
  });
  it('金币不足 → 不开面板并提示', () => {
    G.gold = 3;
    econ.tryPrepClick(C.CT.left + C.EB_W + 6 + 2, C.EB_Y + 2);
    expect(G.panel).toBeNull();
  });
  it('候选保底命中羁绊缺口(差 1 到 4 档优先)', () => {
    for (let i = 0; i < 3; i++) forge.addBall(5, 100 + i * 60, 300, 0, 1, i);   // 3 艘异星 → fac1 差 1 到 4
    G.gold = 20;
    econ.openRecruit(false);
    expect(G.recruitOffers![0].fac).toBe(1);
  });
  it('舰种缺口同样保底(count=1 差 1 到 2 档)', () => {
    forge.addBall(5, 120, 300, 0, 0, 3);                        // 1 艘辅助 → cls3 差 1 到 2
    G.gold = 20;
    econ.openRecruit(false);
    expect(G.recruitOffers![0].cls).toBe(3);
  });
  it('选卡:扣 15 金币,按候选标签空降,面板关闭', () => {
    G.gold = 20;
    econ.openRecruit(false);
    const o = G.recruitOffers![1];
    flow.pointerDown(...card(1));                               // 走 flow 输入路由
    expect(G.gold).toBe(5);
    expect(G.panel).toBeNull();
    const dep = forge.deployables();
    expect(dep.length).toBe(1);
    expect(dep[0].gTier).toBe(o.tier); expect(dep[0].fac).toBe(o.fac); expect(dep[0].cls).toBe(o.cls);
  });
  it('选卡时金币不足 → 不扣不出,面板保持', () => {
    G.gold = 20;
    econ.openRecruit(false);
    G.gold = 3;                                                 // 开着面板把钱花没了(如极端时序)
    flow.pointerDown(...card(0));
    expect(G.gold).toBe(3);
    expect(forge.deployables().length).toBe(0);
    expect(G.panel).toBe('recruit');
  });
  it('取消:不花钱,面板关闭', () => {
    G.gold = 20;
    econ.openRecruit(false);
    flow.pointerDown(C.RC.CANCEL.x + 5, C.RC.CANCEL.y + 5);
    expect(G.gold).toBe(20);
    expect(G.panel).toBeNull();
    expect(forge.deployables().length).toBe(0);
  });
  it('广告入口:播完打开免费面板,选卡不扣费;只发一次', () => {
    G.gold = 0;
    econ.tryPrepClick(C.CT.left + (C.EB_W + 6) * 2 + 2, C.EB_Y + 2);   // 📺 免费定向招募
    expect(ads.active()).toBe(true);
    expect(G.panel).toBeNull();
    ads.update(4);
    expect(G.panel).toBe('recruit');
    expect(G.recruitFree).toBe(true);
    flow.pointerDown(...card(2));
    expect(G.gold).toBe(0);
    expect(forge.deployables().length).toBe(1);
    ads.update(4);                                              // 不会重复发奖
    expect(G.panel).toBeNull();
    expect(forge.deployables().length).toBe(1);
  });
  it('固定 seed 候选序列可复现', () => {
    G.gold = 99;
    seedRng(777); econ.openRecruit(false);
    const a = JSON.stringify(G.recruitOffers);
    econ.closeRecruit();
    seedRng(777); econ.openRecruit(false);
    expect(JSON.stringify(G.recruitOffers)).toBe(a);
  });
  it('底部主键在面板开着时是「关闭招募面板」', () => {
    G.gold = 20;
    econ.openRecruit(false);
    expect(flow.uiModel().fire).toBe('关闭招募面板');
    flow.onFire();
    expect(G.panel).toBeNull();
  });
});
