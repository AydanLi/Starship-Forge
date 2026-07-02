/* economy.js — 系统层：金币消费与结算页广告点位入口。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const { rand, inRect } = SF.util;

  function spendRefresh() {
    const G = SF.G, C = SF.C;
    if (G.gold < C.REFRESH_COST) { SF.ui.flashHint('金币不足（打赢波次赚金币）'); return; }
    G.gold -= C.REFRESH_COST;
    if (G.current) G.current.tier = SF.util.pickDropTier();
    G.nextTier = SF.util.pickDropTier();
    SF.ui.flashHint('投放队列已刷新'); SF.ui.update(); SF.save.write();
  }
  function spendRecruit() {
    const G = SF.G, C = SF.C;
    if (G.gold < C.RECRUIT_COST) { SF.ui.flashHint('金币不足，可看广告免费招募 →'); return; }
    G.gold -= C.RECRUIT_COST; grantRecruit(); SF.save.write();
  }
  function grantRecruit() {
    const C = SF.C;
    const x = rand(C.CT.left + 60, C.CT.right - 60);
    SF.forge.addBall(C.DEPLOY_MIN, x, C.Y_DROP, 0.5);   // 空降一艘可上阵战舰（随机阵营/舰种）
    SF.fx.burst(x, C.Y_DROP + 20, '#7cf3ff', 14); SF.fx.setShake(5);
    SF.ui.flashHint('援军空降！一艘攻击无人机加入熔炉'); SF.ui.update();
  }

  SF.econ = {
    // 备战按钮条（render 画、input 命中）
    BTNS: [
      { xOf: C => C.CT.left, label: () => '刷新队列 ' + SF.C.REFRESH_COST + '💰', act: spendRefresh },
      { xOf: C => C.CT.left + SF.C.EB_W + 6, label: () => '招募援军 ' + SF.C.RECRUIT_COST + '💰', act: spendRecruit },
      { xOf: C => C.CT.left + (SF.C.EB_W + 6) * 2, label: () => '📺 免费援军', act: () => SF.ads.show('招募援军', grantRecruit) }
    ],
    grantRecruit,
    /** PREP 阶段画布点击：命中经济按钮则执行并返回 true */
    tryPrepClick(px, py) {
      const C = SF.C;
      if (py < C.EB_Y || py > C.EB_Y + C.EB_H) return false;
      for (const b of this.BTNS) { const x = b.xOf(C); if (px >= x && px <= x + C.EB_W) { b.act(); return true; } }
      return false;
    },
    /** RESULT 阶段画布点击：命中广告按钮则执行并返回 true */
    tryResultClick(px, py) {
      const G = SF.G, C = SF.C;
      if (G.result === 'win' && !G.goldDoubled && inRect(px, py, C.BTN_DOUBLE)) {
        SF.ads.show('金币双倍', () => { G.gold += G.lastGain; G.goldDoubled = true; SF.ui.flashHint('金币双倍到账 +' + G.lastGain); SF.save.write(true); });
        return true;
      }
      if (G.result === 'lose' && inRect(px, py, C.BTN_OVERLOAD)) {
        SF.ads.show('旗舰超载', () => { G.overloadBoost = true; SF.main.retryWave(); SF.ui.setHint('⚡ 超载待命：下次开战全队攻击 +50%'); });
        return true;
      }
      return false;
    }
  };
})();
