/* main.js — 装配层：接线、流程控制（下一波/重试/开局）、主循环。 */
window.SF = window.SF || {};
(function () {
  'use strict';

  function toPrep(msg) {
    const G = SF.G;
    G.pUnits = []; G.eUnits = [];
    G.slots = [null, null, null, null, null, null]; G.bench = [];
    G.phase = 'PREP';
    SF.forge.spawnCurrent();
    SF.ui.setHint(msg);
    SF.save.write(true);   // 关键进度点：立即写档
  }
  function nextAfterWin() {
    const G = SF.G, C = SF.C, S = SF.STORY;
    const wasBoss = G.wave === C.WAVES_PER_LEVEL - 1;
    if (wasBoss) { G.level++; G.wave = 0; } else G.wave++;
    toPrep('备战：合成战舰，凑齐羁绊再「编队部署」');
    if (wasBoss) { if (G.level < S.SECTORS.length) SF.storySys.queue(S.SECTORS[G.level]); else if (G.level === S.SECTORS.length) SF.storySys.queue(S.ENDING); }
    else if (G.wave === C.WAVES_PER_LEVEL - 1) SF.storySys.queue(SF.storySys.bossCard(G.level));
    SF.storySys.advance();
  }
  function retryWave() { toPrep('备战：重整旗鼓，重新合成部署'); }

  function startRun(saved) {
    const G = SF.G, S = SF.STORY;
    SF.forge.reset();
    G.reset();
    SF.fx.clear(); SF.ads.reset();
    if (saved) {   // 续档：恢复进度，跳过序章
      G.level = saved.level; G.wave = saved.wave; G.gold = saved.gold;
      G.score = saved.score; G.bestTier = saved.bestTier;
    }
    SF.forge.spawnCurrent();
    if (saved) {
      SF.ui.setHint('已读取存档：星区 ' + (G.level + 1) + ' · 第 ' + (G.wave + 1) + ' 波，继续征程');
      SF.ui.update();
    } else {
      SF.ui.setHint(SF.ui.PREP_HINT);
      SF.storySys.queue(S.INTRO, S.SECTORS[0]); SF.storySys.advance();
      SF.save.write(true);
    }
  }
  function freshRun() { SF.save.clear(); startRun(null); }   // 重新开始 = 清档从头
  function boot() {
    const r = SF.save.load();
    if (r && r.tampered) { SF.save.clear(); startRun(null); SF.ui.flashHint('⚠ 存档校验失败（疑似被修改），进度已重置'); return; }
    if (r && SF.save.hasProgress(r.data)) { startRun(r.data); return; }
    startRun(null);
  }

  function onFire() {
    const G = SF.G;
    if (SF.ads.active()) return;
    if (G.story) { SF.storySys.advance(); return; }
    if (G.phase === 'PREP') SF.board.enter();
    else if (G.phase === 'DEPLOY') SF.battle.start();
    else if (G.phase === 'BATTLE') SF.battle.tactical();
    else if (G.phase === 'RESULT') { G.result === 'win' ? nextAfterWin() : retryWave(); }
  }

  let last = performance.now();
  function loop(now) {
    const G = SF.G;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    SF.ads.update(dt);
    if (!G.story && !SF.ads.active()) {
      if (G.phase === 'PREP') SF.forge.update(dt);
      else if (G.phase === 'BATTLE') SF.battle.update(dt);
      SF.fx.update(dt);
      SF.ui.tick(dt);
    }
    SF.render.draw();
    requestAnimationFrame(loop);
  }

  SF.main = { startRun, freshRun, retryWave, nextAfterWin };

  SF.ui.bind(onFire, freshRun);
  SF.input.bind();
  boot();
  requestAnimationFrame(loop);
})();
