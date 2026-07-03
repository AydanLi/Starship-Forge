/* ads.ts — 广告点位。抖音真机走真激励视频（platform.showRewardedAd）；
   浏览器/编辑器预览走 3 秒模拟倒计时（与 web 原型一致）。 */
import { C } from './config';
import { audio } from './audio';
import { platform } from './platform';

let adSim: { t: number, label: string, cb: () => void } | null = null;
let uiDirty = () => {};
export function bindUiDirty(f: () => void) { uiDirty = f; }

export const ads = {
  show(label: string, cb: () => void): void {
    if (adSim) return;
    if (platform.hasRealAd()) {
      // 真广告：SDK 自己接管全屏，无需游戏内倒计时
      platform.showRewardedAd(ok => { if (ok) { audio.play('coin'); cb(); } uiDirty(); });
      return;
    }
    adSim = { t: C.AD_SECONDS, label, cb }; uiDirty();
  },
  active(): boolean { return !!adSim; },
  current() { return adSim; },
  reset(): void { adSim = null; },
  update(dt: number): void {
    if (!adSim) return;
    adSim.t -= dt;
    if (adSim.t <= 0) { const cb = adSim.cb; adSim = null; audio.play('coin'); cb(); uiDirty(); }
  }
};
