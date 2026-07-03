/* economy.ts — 金币消费与结算页广告点位入口（与 js/economy.js 一致）。 */
import { C, rand, inRect, pickDropTier } from './config';
import { G, setHint, flashHint } from './state';
import { forge } from './forge';
import { fx } from './fx';
import { audio } from './audio';
import { save } from './save';
import { ads } from './ads';

let uiDirty = () => {};
let retryWaveFn = () => {};
export function bindUiDirty(f: () => void) { uiDirty = f; }
export function bindRetryWave(f: () => void) { retryWaveFn = f; }

function spendRefresh(): void {
  if (G.gold < C.REFRESH_COST) { flashHint('金币不足（打赢波次赚金币）'); audio.play('deny'); return; }
  G.gold -= C.REFRESH_COST;
  if (G.current) G.current.tier = pickDropTier();
  G.nextTier = pickDropTier();
  flashHint('投放队列已刷新'); audio.play('coin'); uiDirty(); save.write();
}
function spendRecruit(): void {
  if (G.gold < C.RECRUIT_COST) { flashHint('金币不足，可看广告免费招募 →'); audio.play('deny'); return; }
  G.gold -= C.RECRUIT_COST; audio.play('coin'); grantRecruit(); save.write();
}
function grantRecruit(): void {
  const x = rand(C.CT.left + 60, C.CT.right - 60);
  forge.addBall(C.DEPLOY_MIN, x, C.Y_DROP, 0.5);
  fx.burst(x, C.Y_DROP + 20, '#7cf3ff', 14); fx.setShake(5); audio.play('deploy');
  flashHint('援军空降！一艘攻击无人机加入熔炉'); uiDirty();
}

export const econ = {
  BTNS: [
    { xOf: () => C.CT.left, label: () => '刷新队列 ' + C.REFRESH_COST + '💰', act: spendRefresh },
    { xOf: () => C.CT.left + C.EB_W + 6, label: () => '招募援军 ' + C.RECRUIT_COST + '💰', act: spendRecruit },
    { xOf: () => C.CT.left + (C.EB_W + 6) * 2, label: () => '📺 免费援军', act: () => ads.show('招募援军', grantRecruit) }
  ],
  grantRecruit,
  tryPrepClick(px: number, py: number): boolean {
    if (py < C.EB_Y || py > C.EB_Y + C.EB_H) return false;
    for (const b of this.BTNS) { const x = b.xOf(); if (px >= x && px <= x + C.EB_W) { b.act(); return true; } }
    return false;
  },
  tryResultClick(px: number, py: number): boolean {
    if (G.result === 'win' && !G.goldDoubled && inRect(px, py, C.BTN_DOUBLE)) {
      ads.show('金币双倍', () => { G.gold += G.lastGain; G.goldDoubled = true; flashHint('金币双倍到账 +' + G.lastGain); save.write(true); });
      return true;
    }
    if (G.result === 'lose' && inRect(px, py, C.BTN_OVERLOAD)) {
      ads.show('旗舰超载', () => { G.overloadBoost = true; retryWaveFn(); setHint('⚡ 超载待命：下次开战全队攻击 +50%'); });
      return true;
    }
    return false;
  }
};
