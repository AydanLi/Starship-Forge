/* 测试环境准备:提供 Matter 物理库的最小桩(core/forge.ts 以全局 Matter 访问插件脚本)。
   桩只实现 forge 用到的 API,刚体不做真实物理,Composite 维护数组即可——
   这让「招募援军→熔炉出现带标签刚体」这类规则测试无需真实物理引擎。 */

function mkWorld() { return { bodies: [] as any[] }; }

(globalThis as any).Matter = {
  Engine: {
    create: () => ({ gravity: { y: 0 }, positionIterations: 0, velocityIterations: 0, world: mkWorld() }),
    update: (_e: any, _ms: number) => {}
  },
  Bodies: {
    circle: (x: number, y: number, r: number, opt: any) => ({ position: { x, y }, circleRadius: r, speed: 0, ...opt }),
    rectangle: (x: number, y: number, w: number, h: number, opt: any) => ({ position: { x, y }, w, h, ...opt })
  },
  Body: { setVelocity: (b: any, v: any) => { b.velocity = v; } },
  Composite: {
    add: (w: any, b: any) => { Array.isArray(b) ? w.bodies.push(...b) : w.bodies.push(b); },
    remove: (w: any, b: any) => { const i = w.bodies.indexOf(b); if (i >= 0) w.bodies.splice(i, 1); },
    allBodies: (w: any) => w.bodies,
    clear: (w: any, _keepStatic: boolean) => { w.bodies.length = 0; }
  },
  Events: { on: (_e: any, _n: string, _f?: any) => {} }
};
