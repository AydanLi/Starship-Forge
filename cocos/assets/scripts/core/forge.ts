/* forge.ts — 熔炉：matter.js 物理、投放、同级合成、过载（与 js/forge.js 一致）。
   matter.min.js 以插件脚本加载，提供全局 Matter（见 globals.d.ts）。 */
import { C, clamp, pickDropTier } from './config';
import { rng } from './rng';
import { SavedShip, packShip, unpackShip } from './types';
import { G } from './state';
import { fx } from './fx';
import { audio } from './audio';
import { setHint } from './state';

let engine: any = null, world: any = null;
let mergeQueue: any[][] = [];
// 帧率无关化:物理固定步长累加器 / 模拟时钟(替代 performance.now) / 投放重生计时(替代 setTimeout)
const PHYS_STEP = 1 / 60;
let phAcc = 0, simTime = 0, respawnT = -1;
let uiDirty = () => {};   // 由 flow 注入，替代原 SF.ui.update()

export function bindUiDirty(f: () => void) { uiDirty = f; }

function onCollide(ev: any) {
  for (const p of ev.pairs) {
    const a = p.bodyA, b = p.bodyB;
    if (a.gTier === undefined || b.gTier === undefined || a.merging || b.merging || a.gTier !== b.gTier || a.gTier >= C.TIERS.length - 1) continue;
    a.merging = b.merging = true; mergeQueue.push([a, b]);
  }
}
function processMerges() {
  for (const [a, b] of mergeQueue) forge.mergeBodies(a, b);
  if (mergeQueue.length) { mergeQueue.length = 0; uiDirty(); }
}
function checkOverflow(dt: number) {
  const M = Matter;
  for (const b of M.Composite.allBodies(world)) {
    if (b.gTier === undefined || simTime - b.born < 0.4) continue;
    if (b.position.y - b.circleRadius < C.Y_WARN && b.speed < 1.3) b.overTime += dt; else b.overTime = 0;
    if (b.overTime > C.OVER_LIMIT) {
      G.phase = 'GAMEOVER'; G.over = true; G.current = null;
      audio.play('overload');
      uiDirty(); setHint('熔炉过载！舰队全灭——「重开本波」原地再来，或返回主界面'); return;
    }
  }
}

export const forge = {
  reset(): void {
    const M = Matter;
    if (world) M.Composite.clear(world, false);
    engine = M.Engine.create(); engine.gravity.y = 1.0;
    engine.positionIterations = 10; engine.velocityIterations = 8; world = engine.world;
    const o = { isStatic: true, restitution: 0.1, friction: 0.4 }, t = 40;
    M.Composite.add(world, [
      M.Bodies.rectangle((C.CT.left + C.CT.right) / 2, C.CT.floor + t / 2, (C.CT.right - C.CT.left) + 40, t, o),
      M.Bodies.rectangle(C.CT.left - t / 2, (C.CT.top + C.CT.floor) / 2, t, (C.CT.floor - C.CT.top) + 200, o),
      M.Bodies.rectangle(C.CT.right + t / 2, (C.CT.top + C.CT.floor) / 2, t, (C.CT.floor - C.CT.top) + 200, o)
    ]);
    M.Events.on(engine, 'collisionStart', onCollide);
    mergeQueue = []; phAcc = 0; respawnT = -1;
  },
  spawnCurrent(): void {
    const t = G.nextTier; G.nextTier = pickDropTier();
    G.current = { tier: t, x: C.W / 2 }; G.canDrop = true; uiDirty();
  },
  drop(): void {
    if (G.phase !== 'PREP' || !G.current || !G.canDrop || G.over) return;
    const r = C.TIERS[G.current.tier].r;
    this.addBall(G.current.tier, clamp(G.current.x, C.CT.left + r + 1, C.CT.right - r - 1), C.Y_DROP, 0.5);
    audio.play('drop');
    G.current = null; G.canDrop = false;
    respawnT = 0.42;   // 游戏循环内计时:随广告/剧情自然暂停,且可确定性回放
  },
  /** 投放刚体。fac/cls/star 可选:招募/回流/续档恢复时指定标签,普通投放随机。 */
  addBall(tier: number, x: number, y: number, vy?: number, fac?: number, cls?: number, star?: number): any {
    const M = Matter, r = C.TIERS[tier].r;
    const b = M.Bodies.circle(x, y, r, { restitution: 0.08, friction: 0.4, frictionStatic: 0.6, density: 0.001, slop: 0.02 });
    b.gTier = tier; b.merging = false; b.overTime = 0; b.born = simTime;
    b.gStar = (star && star > 1) ? Math.min(star, 3) : 1;
    if (tier >= C.DEPLOY_MIN) {
      b.fac = (fac === undefined || fac === null) ? this.pickTag('fac') : fac;
      b.cls = (cls === undefined || cls === null) ? this.pickTag('cls') : cls;
    }
    if (vy) M.Body.setVelocity(b, { x: 0, y: vy });
    M.Composite.add(world, b); return b;
  },
  /** M3 软权重:已拥有≥SOFT_MIN 个的阵营/舰种,被抽中概率 ×SOFT_W(TFT 商店式,SOFT_W=1 退化纯随机)。 */
  pickTag(kind: 'fac' | 'cls'): number {
    const counts = [0, 0, 0, 0];
    for (const b of this.deployables()) { const v = kind === 'fac' ? b.fac : b.cls; if (v !== undefined) counts[v]++; }
    const w = counts.map(c => c >= C.SOFT_MIN ? C.SOFT_W : 1);
    let r = rng.next() * (w[0] + w[1] + w[2] + w[3]);
    for (let i = 0; i < 4; i++) { r -= w[i]; if (r < 0) return i; }
    return 3;
  },
  /** 同级合成:星级取两者较高,阵营/舰种继承星级高的一方(平星继承前者)。 */
  mergeBodies(a: any, b: any): any {
    const M = Matter;
    const nx = (a.position.x + b.position.x) / 2, ny = (a.position.y + b.position.y) / 2, nt = a.gTier + 1;
    const hi = (b.gStar || 1) > (a.gStar || 1) ? b : a;
    M.Composite.remove(world, a); M.Composite.remove(world, b);
    const nb = this.addBall(nt, nx, ny, -1.5, hi.fac, hi.cls, Math.max(a.gStar || 1, b.gStar || 1));
    G.score += C.VALUE[nt]; G.bestTier = Math.max(G.bestTier, nt);
    fx.burst(nx, ny, C.TIERS[nt].c, 8 + nt);
    audio.play('merge', nt);
    if (nt >= 6) fx.addShake(nt * 0.6);
    return nb;
  },
  /** 战舰返航入坞(胜利回流/失败重试还原):从投放口落下。 */
  returnShip(tier: number, fac?: number, cls?: number, star?: number): any {
    const r = C.TIERS[tier].r;
    const x = rng.range(C.CT.left + r + 6, C.CT.right - r - 6);
    return this.addBall(tier, x, C.Y_DROP, 0.5, fac, cls, star);
  },
  /** 熔炉快照(存档用)。缩写字段是既有存档格式,统一经 types.packShip 编码。 */
  snapshot(): SavedShip[] {
    return this.bodies().filter((b: any) => b.gTier !== undefined)
      .map((b: any) => packShip(b.gTier, b.fac, b.cls, b.gStar || 1, Math.round(b.position.x)));
  },
  /** 按快照恢复熔炉(续档/失败还原),经 types.unpackShip 解码为全名四元组。 */
  restore(list: SavedShip[]): void {
    for (const it of (list || [])) {
      const sv = unpackShip(it);
      const r = C.TIERS[sv.tier] ? C.TIERS[sv.tier].r : 15;
      const x = clamp(sv.x === undefined ? C.W / 2 : sv.x, C.CT.left + r + 1, C.CT.right - r - 1);
      this.addBall(sv.tier, x, C.Y_DROP, 0.4, sv.fac, sv.cls, sv.star);
    }
  },
  removeBody(b: any): void { Matter.Composite.remove(world, b); },
  bodies(): any[] { return world ? Matter.Composite.allBodies(world) : []; },
  deployables(): any[] { return this.bodies().filter((b: any) => b.gTier >= C.DEPLOY_MIN); },
  update(dt: number): void {
    simTime += dt;
    // 固定步长:物理速度与刷新率无关(120Hz 真机不再 2 倍速);上限防「死亡螺旋」
    phAcc = Math.min(phAcc + dt, 0.25);
    while (phAcc >= PHYS_STEP) { Matter.Engine.update(engine, 1000 * PHYS_STEP); phAcc -= PHYS_STEP; }
    if (respawnT > 0) { respawnT -= dt; if (respawnT <= 0) { respawnT = -1; if (!G.over && G.phase === 'PREP' && !G.current) this.spawnCurrent(); } }
    processMerges(); checkOverflow(dt);
  }
};
