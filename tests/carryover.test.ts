/* M2 跨波舰队回归:刚体回流 / 残骸回收 / 船坞上限 / 失败重试还原 / 熔炉快照存档 / 敌方数值表。 */
import { describe, it, expect, beforeEach } from 'vitest';
import { C } from '../cocos/assets/scripts/core/config';
import { seedRng } from '../cocos/assets/scripts/core/rng';
import { G, resetG } from '../cocos/assets/scripts/core/state';
import { forge } from '../cocos/assets/scripts/core/forge';
import { battle } from '../cocos/assets/scripts/core/battle';
import { fleet } from '../cocos/assets/scripts/core/fleet';
import { save } from '../cocos/assets/scripts/core/save';
import { user } from '../cocos/assets/scripts/core/user';
import { menu } from '../cocos/assets/scripts/core/menu';
import { board } from '../cocos/assets/scripts/core/board';
import * as flow from '../cocos/assets/scripts/core/flow';

const tok = (tier: number, star: number, fac: number, cls: number) =>
  ({ tier, fac, cls, star, bodies: [] as any[], x: 0, y: 0 });

/** 布阵并开战:slots → battle.start(),返回开战时的己方单位 */
function fight(tokens: any[]): any[] {
  G.phase = 'DEPLOY';
  G.slots = [null, null, null, null, null, null];
  tokens.forEach((t, i) => { G.slots[i] = t; });
  battle.start();
  expect(G.phase).toBe('BATTLE');
  return G.pUnits;
}

beforeEach(() => { resetG(); seedRng(20260708); forge.reset(); user.login('tester'); });

describe('forge 带标签刚体', () => {
  it('addBall 指定 阵营/舰种/星级', () => {
    const b = forge.addBall(6, 240, 300, 0, 2, 3, 2);
    expect(b.fac).toBe(2); expect(b.cls).toBe(3); expect(b.gStar).toBe(2);
  });
  it('不指定时标签随机、星级为 1,星级上限 3', () => {
    const b = forge.addBall(5, 240, 300, 0);
    expect(b.gStar).toBe(1);
    expect(b.fac).toBeGreaterThanOrEqual(0); expect(b.fac).toBeLessThan(4);
    expect(forge.addBall(5, 240, 300, 0, 0, 0, 9).gStar).toBe(3);
  });
  it('同级合成:星级取较高者,标签继承高星一方', () => {
    const a = forge.addBall(5, 200, 300, 0, 0, 0, 1);
    const b = forge.addBall(5, 260, 300, 0, 1, 2, 3);
    const before = G.score;
    const nb = forge.mergeBodies(a, b);
    expect(nb.gTier).toBe(6);
    expect(nb.gStar).toBe(3);
    expect(nb.fac).toBe(1); expect(nb.cls).toBe(2);
    expect(G.score).toBe(before + C.VALUE[6]);
    expect(forge.bodies()).not.toContain(a);
    expect(forge.bodies()).not.toContain(b);
  });
});

describe('胜利回流与残骸回收', () => {
  it('存活者带标签/星级回炉;阵亡者按 VALUE×星级×回收率 折金币;召唤不回流', () => {
    const units = fight([tok(5, 2, 0, 1), tok(6, 1, 1, 2)]);
    expect(units[0].src.star).toBe(2);
    units.push(fleet.mkSummon('mech'));            // 存活召唤物:不应回流
    units[1].alive = false;                         // tier6 阵亡
    G.eUnits.forEach((e: any) => { e.alive = false; });
    battle.end('win');
    const dep = forge.deployables();
    expect(dep.length).toBe(1);
    expect(dep[0].gTier).toBe(5); expect(dep[0].gStar).toBe(2);
    expect(dep[0].fac).toBe(0); expect(dep[0].cls).toBe(1);
    const salvage = Math.round(C.VALUE[6] * C.STAR_MUL[1] * C.SALVAGE_RATE);
    expect(G.lastSalvage).toBe(salvage);
    expect(G.lastLost).toBe(1);
    expect(G.lastReturned).toBe(1);
    expect(G.gold).toBe(G.lastGain + salvage);
    expect(G.deployedSnapshot).toBeNull();
  });
  it('船坞上限:超出 DOCK_CAP 的存活者按折价率回收', () => {
    const cap = C.DOCK_CAP;
    (C as any).DOCK_CAP = 2;
    try {
      const units = fight([tok(5, 1, 0, 0), tok(5, 1, 1, 1), tok(5, 1, 2, 2)]);
      G.eUnits.forEach((e: any) => { e.alive = false; });
      battle.end('win');
      expect(G.lastReturned).toBe(2);
      expect(forge.deployables().length).toBe(2);
      expect(G.lastSalvage).toBe(Math.round(C.VALUE[5] * C.STAR_MUL[1] * C.DOCK_OVER_RATE));
    } finally { (C as any).DOCK_CAP = cap; }
  });
});

describe('失败重试还原', () => {
  it('lose 后 retryWave:开战阵容原样回炉,快照清空', () => {
    fight([tok(5, 2, 0, 1), tok(7, 1, 3, 3)]);
    G.pUnits.forEach((u: any) => { u.alive = false; });
    battle.end('lose');
    expect(G.result).toBe('lose');
    expect(forge.deployables().length).toBe(0);     // 战败时舰未回炉
    flow.retryWave();
    const dep = forge.deployables().sort((a: any, b: any) => a.gTier - b.gTier);
    expect(dep.length).toBe(2);
    expect(dep[0].gTier).toBe(5); expect(dep[0].gStar).toBe(2); expect(dep[0].fac).toBe(0);
    expect(dep[1].gTier).toBe(7); expect(dep[1].cls).toBe(3);
    expect(G.deployedSnapshot).toBeNull();
    expect(G.phase).toBe('PREP');
    expect(G.gold).toBe(0);                          // 失败不发金币不回收
  });
});

describe('熔炉快照存档与恢复', () => {
  it('write→loadProfile→launch:舰队跨会话恢复', () => {
    forge.addBall(5, 200, 300, 0, 0, 1, 2);
    forge.addBall(8, 300, 300, 0, 3, 2, 1);
    forge.addBall(1, 240, 300, 0);                  // 低级零件也入快照
    G.phase = 'MENU';
    save.write(true);
    forge.reset();
    expect(forge.bodies().filter((b: any) => b.gTier !== undefined).length).toBe(0);
    menu.loadProfile();
    expect(G.pendingForge && G.pendingForge.length).toBe(3);
    flow.launch({});
    const dep = forge.deployables().sort((a: any, b: any) => a.gTier - b.gTier);
    expect(dep.length).toBe(2);
    expect(dep[0].gTier).toBe(5); expect(dep[0].gStar).toBe(2); expect(dep[0].cls).toBe(1);
    expect(dep[1].gTier).toBe(8); expect(dep[1].fac).toBe(3);
    expect(forge.bodies().filter((b: any) => b.gTier === 1).length).toBe(1);
    expect(G.pendingForge).toBeNull();
  });
  it('freshRun 不带旧舰队', () => {
    forge.addBall(9, 240, 300, 0, 0, 0, 3);
    flow.freshRun();
    expect(forge.deployables().length).toBe(0);
  });
});

describe('敌方强度数据化(config.ENEMY)', () => {
  it('普通波强度按公式取自 config', () => {
    const E = C.ENEMY;
    const arr = fleet.genEnemies(2, 1);
    expect(arr.length).toBe(Math.min(5, 3 + 2));
    expect(arr[0].maxHp).toBeCloseTo(E.hp * (1 + E.hpLv * 2) * (1 + E.hpWv * 1));
    expect(arr[0].atk).toBeCloseTo(E.atk * (1 + E.atkLv * 2));
  });
  it('Boss 波:Boss + 护卫强度取自 config', () => {
    const E = C.ENEMY;
    const arr = fleet.genEnemies(1, C.WAVES_PER_LEVEL - 1);
    expect(arr[0].isBoss).toBe(true);
    expect(arr[0].maxHp).toBeCloseTo(E.bossHp * (1 + E.bossHpLv * 1));
    expect(arr[1].maxHp).toBeCloseTo(E.minHp * (1 + E.minLv * 1));
  });
});

describe('局内「重新开始」= 只重置本波(回归修复:原先误接 freshRun 清空总进度)', () => {
  it('战斗中重来:星区/波次/金币/分数保留,开战阵容原样回炉', () => {
    G.level = 2; G.wave = 3; G.gold = 77; G.score = 900;
    fight([tok(6, 2, 1, 1), tok(5, 1, 0, 0)]);
    flow.restartWave();
    expect(G.phase).toBe('PREP');
    expect(G.level).toBe(2); expect(G.wave).toBe(3);
    expect(G.gold).toBe(77); expect(G.score).toBe(900);
    const dep = forge.deployables().sort((a: any, b: any) => a.gTier - b.gTier);
    expect(dep.length).toBe(2);
    expect(dep[1].gTier).toBe(6); expect(dep[1].gStar).toBe(2);
    expect(G.deployedSnapshot).toBeNull();
  });
  it('编队中「返回备战」:刚体未离炉,清空阵位即可;星级随刚体保留', () => {
    G.level = 1; G.wave = 2;
    forge.addBall(6, 240, 300, 0, 1, 1, 2);
    G.phase = 'PREP';
    board.enter();
    expect(G.phase).toBe('DEPLOY');
    expect((G.slots.find(Boolean) as any).star).toBe(2);   // 回流的 2 星舰再上阵仍是 2 星
    flow.restartWave();
    expect(G.phase).toBe('PREP');
    expect(G.level).toBe(1); expect(G.wave).toBe(2);
    expect(forge.deployables().length).toBe(1);
    expect(G.slots.filter(Boolean).length).toBe(0);
  });
  it('过载 GAMEOVER 后「重开本波」:进度保留,熔炉按规则为空', () => {
    G.level = 3; G.wave = 1; G.gold = 50;
    forge.addBall(7, 240, 300, 0, 0, 0, 2);
    G.phase = 'GAMEOVER'; G.over = true; G.overHandled = false;
    flow.step(0.016);                                      // 过载结算:清炉+落档
    flow.restartWave();
    expect(G.phase).toBe('PREP');
    expect(G.level).toBe(3); expect(G.wave).toBe(1); expect(G.gold).toBe(50);
    expect(forge.deployables().length).toBe(0);
    expect(G.over).toBe(false);
  });
  it('胜利结算界面不可重来(防奖励重复结算)', () => {
    fight([tok(6, 1, 0, 0)]);
    G.eUnits.forEach((e: any) => { e.alive = false; });
    battle.end('win');
    const gold = G.gold;
    flow.restartWave();
    expect(G.phase).toBe('RESULT');
    expect(G.gold).toBe(gold);
  });
});

describe('资产安全的流程边角', () => {
  it('战斗中途返回主界面:开战阵容回炉并随存档保留,再开始游戏可恢复', () => {
    forge.addBall(1, 240, 300, 0);                       // 炉内还有个零件
    fight([tok(6, 2, 1, 1)]);
    flow.toMenu();
    expect(G.phase).toBe('MENU');
    expect(G.pendingForge && G.pendingForge.length).toBe(2);   // 零件 + 回炉战舰
    flow.launch({});
    const dep = forge.deployables();
    expect(dep.length).toBe(1);
    expect(dep[0].gTier).toBe(6); expect(dep[0].gStar).toBe(2); expect(dep[0].fac).toBe(1);
    // 存档同样带上了舰队(跨会话)
    menu.loadProfile();
    expect(G.pendingForge && G.pendingForge.length).toBe(2);
  });
  it('熔炉过载:舰队全灭并立刻落档', () => {
    forge.addBall(7, 240, 300, 0, 0, 0, 2);
    G.phase = 'GAMEOVER'; G.over = true; G.overHandled = false;
    flow.step(0.016);
    expect(forge.deployables().length).toBe(0);
    menu.loadProfile();
    expect(G.pendingForge).toBeNull();                    // 存档里也没有舰队了
  });
});
