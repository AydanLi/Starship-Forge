/* input.js — 交互层：画布指针事件，按 phase 路由到各系统。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  SF.input = {
    bind() {
      const cv = SF.render.cv, C = SF.C;
      const pX = e => { const r = cv.getBoundingClientRect(); return ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * C.W; };
      const pY = e => { const r = cv.getBoundingClientRect(); return ((e.touches ? e.touches[0].clientY : e.clientY) - r.top) / r.height * C.H; };

      cv.addEventListener('pointermove', e => {
        const G = SF.G;
        if (G.phase === 'PREP' && G.current) G.current.x = pX(e);
        else if (G.phase === 'DEPLOY') SF.board.dragMove(pX(e), pY(e));
      });
      cv.addEventListener('pointerdown', e => {
        const G = SF.G;
        if (SF.ads.active()) return;                      // 广告播放中屏蔽输入
        if (G.story) { SF.storySys.advance(); return; }
        const px = pX(e), py = pY(e);
        if (G.phase === 'LOGIN' || G.phase === 'MENU' || G.phase === 'MAP') { SF.menu.click(px, py); return; }
        if (G.phase === 'RESULT') { SF.econ.tryResultClick(px, py); return; }
        if (G.phase === 'PREP') {
          if (SF.econ.tryPrepClick(px, py)) return;
          if (G.current) { G.current.x = px; SF.forge.drop(); }
        } else if (G.phase === 'DEPLOY') SF.board.dragStart(px, py);
      });
      cv.addEventListener('pointerup', e => { if (SF.G.phase === 'DEPLOY') SF.board.dragEnd(pX(e), pY(e)); });
      cv.addEventListener('pointercancel', () => SF.board.cancelDrag());
    }
  };
})();
