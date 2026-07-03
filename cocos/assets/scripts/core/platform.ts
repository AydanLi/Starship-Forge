/* platform.ts — 平台适配层（唯一允许感知运行环境的逻辑模块，零 cc 依赖）。
   浏览器预览 / 抖音小游戏 / node 无头测试 三端可用。 */

function hasTT(): boolean { return typeof tt !== 'undefined' && !!tt; }
function ls(): Storage | null { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }

const memStore: Record<string, string> = {};

export const platform = {
  isDouyin(): boolean { return hasTT(); },

  // ---- 存储（抖音 tt.*StorageSync / 浏览器 localStorage / node 内存）----
  getItem(k: string): string | null {
    if (hasTT() && tt.getStorageSync) { try { const v = tt.getStorageSync(k); return v === '' || v === undefined ? null : String(v); } catch (e) { return null; } }
    const s = ls(); if (s) { try { return s.getItem(k); } catch (e) {} }
    return k in memStore ? memStore[k] : null;
  },
  setItem(k: string, v: string): void {
    if (hasTT() && tt.setStorageSync) { try { tt.setStorageSync(k, v); return; } catch (e) {} }
    const s = ls(); if (s) { try { s.setItem(k, v); return; } catch (e) {} }
    memStore[k] = v;
  },
  removeItem(k: string): void {
    if (hasTT() && tt.removeStorageSync) { try { tt.removeStorageSync(k); return; } catch (e) {} }
    const s = ls(); if (s) { try { s.removeItem(k); return; } catch (e) {} }
    delete memStore[k];
  },

  // ---- 激励视频：抖音走真 SDK；其他环境返回 false（由 ads.ts 走 3 秒模拟）----
  hasRealAd(): boolean { return hasTT() && !!tt.createRewardedVideoAd; },
  /** 播真广告。done(true)=看完发奖励。⚠ 上线前把 adUnitId 换成你在抖音后台创建的广告位 ID。 */
  showRewardedAd(done: (ok: boolean) => void): void {
    if (!this.hasRealAd()) { done(false); return; }
    try {
      const ad = tt.createRewardedVideoAd({ adUnitId: 'REPLACE_WITH_YOUR_AD_UNIT_ID' });
      const onClose = (res: any) => { ad.offClose(onClose); done(!!(res && (res.isEnded || res.isEnded === undefined))); };
      ad.onClose(onClose);
      ad.onError(() => { ad.offClose(onClose); done(false); });
      ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => done(false)));
    } catch (e) { done(false); }
  },

  // ---- 文本输入（登录代号）：浏览器 prompt / 抖音键盘 ----
  textInput(current: string, cb: (val: string) => void): void {
    if (hasTT() && tt.showKeyboard) {
      let val = current;
      const onInput = (r: any) => { val = r.value; };
      const onConfirm = (r: any) => { cleanup(); cb(r.value !== undefined ? r.value : val); };
      const onComplete = () => { cleanup(); cb(val); };
      const cleanup = () => { tt.offKeyboardInput(onInput); tt.offKeyboardConfirm(onConfirm); tt.offKeyboardComplete(onComplete); tt.hideKeyboard({}); };
      tt.onKeyboardInput(onInput); tt.onKeyboardConfirm(onConfirm); tt.onKeyboardComplete(onComplete);
      tt.showKeyboard({ defaultValue: current, maxLength: 12, multiple: false, confirmHold: false, confirmType: 'done' });
      return;
    }
    if (typeof window !== 'undefined' && (window as any).prompt) {
      const v = (window as any).prompt('输入指挥官代号（2~12字）', current);
      cb(v === null ? current : v);
      return;
    }
    cb(current);
  },

  now(): number { return Date.now(); }
};
