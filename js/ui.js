/* ui.js — 交互层：DOM 按钮与提示条。按钮点击的“做什么”由 main.js 接线。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const fireBtn = document.getElementById('fire');
  const resetBtn = document.getElementById('reset');
  const hintEl = document.getElementById('hint');
  let hintTimer = 0;
  const PREP_HINT = '备战：合成战舰（5级起带阵营/舰种），凑齐羁绊再「编队部署」';

  function setBtn(b, bc, c) { b.style.borderColor = bc; b.style.color = c; }

  SF.ui = {
    PREP_HINT,
    setHint(t) { hintEl.textContent = t; hintTimer = 0; },
    flashHint(t) { hintEl.textContent = t; hintTimer = 2; },
    tick(dt) { if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0 && SF.G.phase === 'PREP') hintEl.textContent = PREP_HINT; } },
    bind(onFire, onReset) { fireBtn.addEventListener('click', onFire); resetBtn.addEventListener('click', onReset); },
    update() {
      const G = SF.G, C = SF.C;
      if (SF.ads.active()) { fireBtn.disabled = true; fireBtn.textContent = '📺 广告播放中…'; return; }
      if (G.story) { fireBtn.disabled = false; fireBtn.textContent = '▶ ' + (G.story.btn || '继续'); setBtn(fireBtn, '#7cf3ff', '#aef5ff'); resetBtn.textContent = '重新开始'; return; }
      if (G.phase === 'PREP') { const n = SF.forge.deployables().length; fireBtn.textContent = '编队部署（' + n + '）'; fireBtn.disabled = n === 0; setBtn(fireBtn, '#00e5ff', '#8fe8ff'); resetBtn.textContent = '重新开始'; }
      else if (G.phase === 'DEPLOY') { const m = G.slots.filter(Boolean).length; fireBtn.textContent = '⚔ 开战（' + m + '）'; fireBtn.disabled = m === 0; setBtn(fireBtn, '#ff2e88', '#ff9dc4'); resetBtn.textContent = '重新开始'; }
      else if (G.phase === 'BATTLE') { fireBtn.textContent = G.tacticalReady ? '⚡ 战术技·全体齐射' : '战术技冷却 ' + Math.ceil(G.tacticalCd) + 's'; fireBtn.disabled = !G.tacticalReady; setBtn(fireBtn, '#ff2e88', '#ff9dc4'); }
      else if (G.phase === 'RESULT') {
        fireBtn.disabled = false;
        if (G.result === 'win') { fireBtn.textContent = (G.wave === C.WAVES_PER_LEVEL - 1 ? '进入下一星区 ▶' : '下一波 ▶'); setBtn(fireBtn, '#7cf3ff', '#aef5ff'); }
        else { fireBtn.textContent = '重试本波 ↻'; setBtn(fireBtn, '#ffb43d', '#ffd08a'); }
      }
      else if (G.phase === 'GAMEOVER') { fireBtn.disabled = true; fireBtn.textContent = '—'; }
    }
  };
})();
