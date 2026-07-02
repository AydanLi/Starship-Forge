/* ads.js — 系统层：广告点位。原型=3秒模拟激励视频。
   ★ 正式上线抖音时，只需改这个文件：把 show() 换成
     tt.createRewardedVideoAd({...}) → onClose(res) 中 res.isEnded 为 true 才执行 cb()。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  let adSim = null;   // {t, label, cb}

  SF.ads = {
    show(label, cb) { if (adSim) return; adSim = { t: SF.C.AD_SECONDS, label, cb }; SF.ui.update(); },
    active() { return !!adSim; },
    current() { return adSim; },
    reset() { adSim = null; },
    update(dt) {
      if (!adSim) return;
      adSim.t -= dt;
      if (adSim.t <= 0) { const cb = adSim.cb; adSim = null; cb(); SF.ui.update(); }
    }
  };
})();
