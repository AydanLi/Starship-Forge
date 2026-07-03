/* fleet.js — 服务层：单位工厂与排布（token→战斗单位、召唤物、敌军生成、站位）。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  SF.fleet = {
    unitFromToken(tok) {
      const C = SF.C, m = C.STAR_MUL[tok.star];
      const u = { tier: tok.tier, star: tok.star, fac: tok.fac, cls: tok.cls, team: 'p', isBoss: false, summon: false,
        maxHp: Math.round(C.B_HP[tok.tier] * m), hp: 0, atk: Math.round(C.B_ATK[tok.tier] * m), spd: C.B_SPD[tok.tier],
        timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true };
      u.hp = u.maxHp; return u;
    },
    mkSummon(kind) {
      return { tier: 4, star: 1, fac: kind === 'mech' ? 2 : 3, cls: 2, team: 'p', isBoss: false, summon: true,
        maxHp: kind === 'mech' ? 160 : 110, hp: kind === 'mech' ? 160 : 110, atk: kind === 'mech' ? 22 : 18, spd: 1.4,
        timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true };
    },
    mkEnemy(hp, atk, spd) {
      return { team: 'e', enemy: true, isBoss: false, summon: false, star: 1, maxHp: hp, hp, atk, spd, timer: 0, front: false, x: 0, y: 0, shield: 0, revived: false, alive: true, tier: 6 };
    },
    genEnemies(lv, wv) {
      const isBoss = wv === SF.C.WAVES_PER_LEVEL - 1, arr = [];
      if (isBoss) {
        SF.G.bossName = SF.STORY.BOSS_NAMES[Math.min(lv, 4)];
        const boss = this.mkEnemy(1500 * (1 + 0.5 * lv), 60 * (1 + 0.45 * lv), 0.85);
        boss.isBoss = true; boss.name = SF.G.bossName; arr.push(boss);
        for (let i = 0; i < (lv >= 1 ? 2 : 1); i++) arr.push(this.mkEnemy(320 * (1 + 0.4 * lv), 26 * (1 + 0.4 * lv), 1.0));
      } else {
        const n = Math.min(5, 3 + lv);
        for (let i = 0; i < n; i++) arr.push(this.mkEnemy(240 * (1 + 0.42 * lv) * (1 + 0.25 * wv), 24 * (1 + 0.38 * lv), 1.0));
      }
      return arr;
    },
    genEnemiesPreview(lv, wv) {
      const isBoss = wv === SF.C.WAVES_PER_LEVEL - 1, a = [];
      if (isBoss) { a.push({ boss: true }); for (let i = 0; i < (lv >= 1 ? 2 : 1); i++) a.push({ boss: false }); }
      else for (let i = 0; i < Math.min(5, 3 + lv); i++) a.push({ boss: false });
      return a;
    },
    layout(units, isEnemy, keepFront) {
      const C = SF.C;
      const alive = units.filter(u => u.alive);
      if (!keepFront) { alive.sort((a, b) => b.maxHp - a.maxHp); const fn = Math.max(1, Math.ceil(alive.length / 2)); alive.forEach((u, i) => u.front = i < fn); }
      const rowY = isEnemy ? { front: 258, back: 176 } : { front: 470, back: 560 };
      const place = (list, y) => { const k = list.length, x0 = C.CT.left + 42, x1 = C.CT.right - 42; list.forEach((u, i) => { u.x = k === 1 ? C.W / 2 : x0 + (x1 - x0) * i / (k - 1); u.y = y; }); };
      place(alive.filter(u => u.front), rowY.front); place(alive.filter(u => !u.front), rowY.back);
    }
  };
})();
