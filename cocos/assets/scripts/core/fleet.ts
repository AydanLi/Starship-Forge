/* fleet.ts — 单位工厂与排布（与 js/fleet.js 一致）。 */
import { C } from './config';
import { G } from './state';
import { STORY } from './storyData';

export const fleet = {
  unitFromToken(tok: any): any {
    const m = C.STAR_MUL[tok.star];
    const u: any = { tier: tok.tier, star: tok.star, fac: tok.fac, cls: tok.cls, team: 'p', isBoss: false, summon: false,
      maxHp: Math.round(C.B_HP[tok.tier] * m), hp: 0, atk: Math.round(C.B_ATK[tok.tier] * m), spd: C.B_SPD[tok.tier],
      timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true };
    u.hp = u.maxHp; return u;
  },
  mkSummon(kind: string): any {
    return { tier: 4, star: 1, fac: kind === 'mech' ? 2 : 3, cls: 2, team: 'p', isBoss: false, summon: true,
      maxHp: kind === 'mech' ? 160 : 110, hp: kind === 'mech' ? 160 : 110, atk: kind === 'mech' ? 22 : 18, spd: 1.4,
      timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true };
  },
  mkEnemy(hp: number, atk: number, spd: number): any {
    return { team: 'e', enemy: true, isBoss: false, summon: false, star: 1, maxHp: hp, hp, atk, spd, timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true, tier: 6 };
  },
  genEnemies(lv: number, wv: number): any[] {
    const isBoss = wv === C.WAVES_PER_LEVEL - 1, arr: any[] = [];
    const E = C.ENEMY;   // M2:强度全部数据化(调平衡改 config.ENEMY)
    if (isBoss) {
      G.bossName = STORY.BOSS_NAMES[Math.min(lv, 4)];
      const boss = this.mkEnemy(E.bossHp * (1 + E.bossHpLv * lv), E.bossAtk * (1 + E.bossAtkLv * lv), 0.85);
      boss.isBoss = true; boss.name = G.bossName; arr.push(boss);
      for (let i = 0; i < (lv >= 1 ? 2 : 1); i++) arr.push(this.mkEnemy(E.minHp * (1 + E.minLv * lv), E.minAtk * (1 + E.minLv * lv), 1.0));
    } else {
      const n = Math.min(5, 3 + lv);
      for (let i = 0; i < n; i++) arr.push(this.mkEnemy(E.hp * (1 + E.hpLv * lv) * (1 + E.hpWv * wv), E.atk * (1 + E.atkLv * lv), 1.0));
    }
    return arr;
  },
  genEnemiesPreview(lv: number, wv: number): { boss: boolean }[] {
    const isBoss = wv === C.WAVES_PER_LEVEL - 1, a: { boss: boolean }[] = [];
    if (isBoss) { a.push({ boss: true }); for (let i = 0; i < (lv >= 1 ? 2 : 1); i++) a.push({ boss: false }); }
    else for (let i = 0; i < Math.min(5, 3 + lv); i++) a.push({ boss: false });
    return a;
  },
  layout(units: any[], isEnemy: boolean, keepFront: boolean): void {
    const alive = units.filter(u => u.alive);
    if (!keepFront) { alive.sort((a, b) => b.maxHp - a.maxHp); const fn = Math.max(1, Math.ceil(alive.length / 2)); alive.forEach((u, i) => u.front = i < fn); }
    const rowY = isEnemy ? { front: 258, back: 176 } : { front: 470, back: 560 };
    const place = (list: any[], y: number) => { const k = list.length, x0 = C.CT.left + 42, x1 = C.CT.right - 42; list.forEach((u, i) => { u.x = k === 1 ? C.W / 2 : x0 + (x1 - x0) * i / (k - 1); u.y = y; }); };
    place(alive.filter(u => u.front), rowY.front); place(alive.filter(u => !u.front), rowY.back);
  }
};
