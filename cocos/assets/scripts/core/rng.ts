/* rng.ts — 可播种随机（mulberry32，零依赖）。
   玩法随机（掉落/标签/寻敌/暴击/溅射/招募落点）一律走 rng，保证固定 seed 可复盘;
   纯视觉随机（粒子/飘字偏移/星空）继续用 Math.random，不影响逻辑回放。
   seed 在开新征程时生成并写入存档（G.seed），未来的「每日挑战」按日期哈希播种即可。 */

export interface Rng {
  next(): number;                     // [0,1)
  int(max: number): number;           // [0,max) 整数
  pick<T>(a: T[]): T;
  range(a: number, b: number): number;
  chance(p: number): boolean;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

let _seed = 0;
let _next: () => number = Math.random;

/** 重新播种。不传 seed 时随机生成一个并返回（调用方负责存档）。 */
export function seedRng(seed?: number): number {
  _seed = (seed === undefined ? ((Math.random() * 0x7fffffff) ^ (Date.now() & 0xffff)) : seed) >>> 0;
  if (_seed === 0) _seed = 1;
  _next = mulberry32(_seed);
  return _seed;
}
export function rngSeed(): number { return _seed; }

seedRng();   // 默认随机播种，保证未接线时行为与 Math.random 等价

export const rng: Rng = {
  next: () => _next(),
  int: (max: number) => (_next() * max) | 0,
  pick: <T>(a: T[]): T => a[(_next() * a.length) | 0],
  range: (a: number, b: number) => a + _next() * (b - a),
  chance: (p: number) => _next() < p
};
