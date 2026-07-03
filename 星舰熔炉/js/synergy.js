/* synergy.js — 服务层：羁绊计算（纯函数）。数值调整只改这个文件。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  SF.synergy = {
    compute(units) {
      const FAC = SF.C.FAC;
      const fc = [0, 0, 0, 0], cc = [0, 0, 0, 0];
      for (const u of units) { if (u.summon) continue; fc[u.fac]++; cc[u.cls]++; }
      const b = { atkMul: 1, spdMul: 1, crit: 0, dmgMul: 1, frontRed: 0, regen: 0, shieldPct: 0, revive: false, splash: false, summonMech: 0, summonDrone: 0, heal: 0 };
      const active = [], chip = (n, k, c) => active.push({ t: n + '×' + k, c });
      if (fc[0] >= 2) { b.atkMul *= fc[0] >= 4 ? 1.35 : 1.15; chip('帝国', fc[0], FAC[0].c); }
      if (fc[1] >= 2) { b.regen += 0.02; if (fc[1] >= 4) b.revive = true; chip('异星', fc[1], FAC[1].c); }
      if (fc[2] >= 2) { b.shieldPct = fc[2] >= 4 ? 0.25 : 0.10; if (fc[2] >= 4) b.summonMech = 2; chip('机械', fc[2], FAC[2].c); }
      if (fc[3] >= 2) { b.crit = 0.2; if (fc[3] >= 4) b.spdMul *= 1.4; chip('赛博', fc[3], FAC[3].c); }
      if (cc[0] >= 2) { b.frontRed = cc[0] >= 4 ? 0.4 : 0.2; chip('突击', cc[0], '#dfe8f5'); }
      if (cc[1] >= 2) { b.dmgMul *= 1.25; if (cc[1] >= 4) b.splash = true; chip('炮舰', cc[1], '#dfe8f5'); }
      if (cc[2] >= 2) { b.summonDrone = cc[2] >= 4 ? 3 : 1; chip('无人机', cc[2], '#dfe8f5'); }
      if (cc[3] >= 2) { b.heal = 0.02; chip('辅助', cc[3], '#dfe8f5'); }
      return { buffs: b, active };
    },
    applyBuffs(units, b) {
      for (const u of units) { u.atk = Math.round(u.atk * b.atkMul * b.dmgMul); u.spd *= b.spdMul; u.shield = Math.round(u.maxHp * b.shieldPct); }
    }
  };
})();
