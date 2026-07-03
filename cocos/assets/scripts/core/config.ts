/* config.ts — 数据层：全部数值配置 + 通用工具（与 web 原型 js/config.js 一一对应）。 */

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
export const pickDropTier = () => C.DROP_POOL[(Math.random() * C.DROP_POOL.length) | 0];
