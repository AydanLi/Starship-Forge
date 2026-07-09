/* config.ts — 数据层：全部数值配置 + 通用工具（与 web 原型 js/config.js 一一对应）。 */
import { rng } from './rng';

export const W = 480, H = 760;
export const CT = { left: 30, right: 450, floor: 726, top: 150 };

export const C = {
  W, H, CT,
  Y_DROP: 168, Y_WARN: 214, OVER_LIMIT: 2.0,
  TIERS: [
    { name: '纳米芯片', r: 15, c: '#5fd0ff' }, { name: '能量电池', r: 21, c: '#35e0c0' },
    { name: '武器模块', r: 27, c: '#7cff8a' }, { name: '激光炮台', r: 34, c: '#ffd24a' },
    { name: '攻击无人机', r: 42, c: '#ff9d3a' }, { name: '星际战机', r: 51, c: '#ff6a3a' },
    { name: '护卫舰', r: 61, c: '#ff4d7a' }, { name: '驱逐舰', r: 72, c: '#ff3ea0' },
    { name: '巡洋舰', r: 85, c: '#c86bff' }, { name: '战列舰', r: 100, c: '#8391ff' },
    { name: '母舰', r: 118, c: '#ffe66a' }
  ],
  VALUE: [1, 3, 6, 12, 25, 50, 100, 200, 400, 800, 1600],
  DROP_POOL: [0, 0, 0, 0, 0, 1, 1, 1, 2, 3],
  DEPLOY_MIN: 4,
  B_HP: [0, 0, 0, 0, 200, 350, 600, 1000, 1700, 2900, 5000],
  B_ATK: [0, 0, 0, 0, 30, 55, 95, 160, 270, 450, 750],
  B_SPD: [1, 1, 1, 1, 1.2, 1.1, 1.0, 0.95, 0.9, 0.85, 0.8],
  STAR_MUL: [0, 1, 1.8, 3.2],
  FAC: [{ name: '帝国', c: '#ff9d00' }, { name: '异星', c: '#ff2e5b' }, { name: '机械', c: '#5fb0ff' }, { name: '赛博', c: '#b06bff' }],
  CLS: [{ name: '突击' }, { name: '炮舰' }, { name: '无人机' }, { name: '辅助' }],
  WAVES_PER_LEVEL: 3,
  /* M2 敌方强度表(跨波回流后整体上调;调平衡只改这里) */
  ENEMY: {
    hp: 260, hpLv: 0.5, hpWv: 0.3, atk: 26, atkLv: 0.44,          // 普通波
    bossHp: 1600, bossHpLv: 0.58, bossAtk: 64, bossAtkLv: 0.5,    // Boss
    minHp: 340, minAtk: 28, minLv: 0.45                            // Boss 护卫
  },
  /* M2 跨波舰队:阵亡残骸回收率 / 船坞容量(单次回流上限) / 超限折价率 */
  SALVAGE_RATE: 0.3, DOCK_CAP: 10, DOCK_OVER_RATE: 0.6,
  /* M3 构筑可控:软权重(已拥有≥SOFT_MIN 个的阵营/舰种,抽中权重×SOFT_W;设 1 退化为纯随机)
     招募候选:三选一,RECRUIT_T2_P 概率出 6 级(否则 5 级);候选卡/取消按钮命中区(供 core 与视图共用) */
  SOFT_W: 2.0, SOFT_MIN: 2, RECRUIT_T2_P: 0.25,
  /* M4 Boss 机制(按星区索引,声明式;battle.ts 通用 handler 解释执行)。
     每个机制都是「战术技时机」的考题:留技清场/破盾窗口/攒队清潮/压制抢拍/抢在斩杀前爆发 */
  BOSS_SKILLS: [
    { type: 'summon',  threshold: 0.5, count: 2, warn: '召唤护卫' },     // S1 秃鹫号:半血一次性召唤
    { type: 'shield',  interval: 8, value: 800, warn: '充能护盾' },      // S2 铁卫:周期护盾
    { type: 'hatch',   interval: 6, count: 2, warn: '孵化虫群' },        // S3 虫族女皇:持续孵化(弱化体)
    { type: 'silence', interval: 10, duration: 4, warn: '信号压制' },    // S4 零号意志:锁战术技
    { type: 'snipe',   interval: 7, mult: 3.0, warn: '锁定齐射' }        // S5 万王之王:点名前排
  ] as any[],
  BOSS_WARN: 1.0,   // 施放前预警秒数(黄圈闪烁 + 飘字)
  RC: {
    CARDS: [{ x: 30, y: 236, w: 130, h: 190 }, { x: 175, y: 236, w: 130, h: 190 }, { x: 320, y: 236, w: 130, h: 190 }],
    CANCEL: { x: 150, y: 448, w: 180, h: 42 }
  },
  REFRESH_COST: 8, RECRUIT_COST: 15,
  AD_SECONDS: 3,
  SLOTC: [{ x: 138, y: 300 }, { x: 240, y: 300 }, { x: 342, y: 300 },
          { x: 138, y: 402 }, { x: 240, y: 402 }, { x: 342, y: 402 }],
  SLOT_HALF: 44,
  EB_Y: 100, EB_H: 34, EB_W: (CT.right - CT.left - 12) / 3,
  BTN_DOUBLE: { x: W / 2 - 110, y: H / 2 + 78, w: 220, h: 40 },
  BTN_OVERLOAD: { x: W / 2 - 148, y: H / 2 + 78, w: 296, h: 40 }
};

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const inRect = (px: number, py: number, r: { x: number, y: number, w: number, h: number }) =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
export const pickDropTier = () => rng.pick(C.DROP_POOL);   // 玩法随机走可播种 rng
