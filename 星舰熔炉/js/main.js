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
    if (wasBoss) { G.level++; G.wave = 0; G.maxLevel = Math.max(G.maxLevel, G.level); } else G.wave++;
    toPrep('备战：合成战舰，凑齐羁绊再「编队部署」');
    if (wasBoss) { if (G.level < S.SECTORS.length) SF.storySys.queue(S.SECTORS[G.level]); else if (G.level === S.SECTORS.length) SF.storySys.queue(S.ENDING); }
    else if (G.wave === C.WAVES_PER_LEVEL - 1) SF.storySys.queue(SF.storySys.bossCard(G.level));
    SF.storySys.advance();
  }
  function retryWave() { toPrep('备战：重整旗鼓，重新合成部署'); }

  /** 进入战局（保留 G 中的进度字段，重置战场）。opts: {intro} 播序章 | {sectorCard:i} 播星区卡 */
  function launch(opts) {
    const G = SF.G, S = SF.STORY;
    opts = opts || {};
    SF.forge.reset(); SF.fx.clear(); SF.ads.reset();
    G.pUnits = []; G.eUnits = []; G.slots = [null, null, null, null, null, null]; G.bench = []; G.dragging = null;
    G.story = null; G.storyQueue = []; G.panel = null;
    G.lastGain = 0; G.goldDoubled = true; G.overloadBoost = false;
    G.phase = 'PREP'; G.over = false;
    G.nextTier = SF.util.pickDropTier();
    SF.forge.spawnCurrent();
    if (opts.intro) { SF.ui.setHint(SF.ui.PREP_HINT); SF.storySys.queue(S.INTRO, S.SECTORS[0]); SF.storySys.advance(); }
    else if (opts.sectorCard !== undefined) { SF.ui.setHint(SF.ui.PREP_HINT); SF.storySys.queue(S.SECTORS[opts.sectorCard]); SF.storySys.advance(); }
    else { SF.ui.setHint('星区 ' + (G.level + 1) + ' · 第 ' + (G.wave + 1) + ' 波 — ' + SF.ui.PREP_HINT); SF.ui.update(); }
    SF.save.write(true);
  }
  /** 主界面「开始游戏」：有进度→续档进入；无进度→播序章 */
  function startGame() {
    const G = SF.G;
    if (G.level > 0 || G.wave > 0 || G.gold > 0 || G.score > 0) launch({});
    else launch({ intro: true });
  }
  /** 重新开始（战局内 reset 按钮）：清空本账号进度，从序章重来 */
  function freshRun() {
    const G = SF.G;
    SF.save.clear();
    G.level = 0; G.wave = 0; G.gold = 0; G.score = 0; G.bestTier = 0; G.maxLevel = 0;
    launch({ intro: true });
  }
  function boot() {
    if (SF.user.uid()) {   // 记住上次登录 → 直接进主界面
      const r = SF.save.load();
      const G = SF.G;
      if (r && r.tampered) { SF.save.clear(); SF.menu.toMenu(); SF.ui.flashHint('⚠ 存档校验失败（疑似被修改），进度已重置'); return; }
      if (r && r.data) { const d = r.data; G.level = d.level; G.wave = d.wave; G.gold = d.gold; G.score = d.score; G.bestTier = d.bestTier; G.maxLevel = d.maxLevel || d.level; }
      SF.menu.toMenu();
    } else SF.menu.toLogin();
  }

  function onFire() {
    const G = SF.G;
    if (SF.ads.active()) return;
    if (G.story) { SF.storySys.advance(); return; }
    if (G.phase === 'LOGIN') SF.menu.confirmLogin(false);
    else if (G.phase === 'MENU') { if (G.panel) SF.menu.closeSettings(); else startGame(); }
    else if (G.phase === 'MAP') SF.menu.toMenu();
    else if (G.phase === 'PREP') SF.board.enter();
    else if (G.phase === 'DEPLOY') SF.battle.start();
    else if (G.phase === 'BATTLE') SF.battle.tactical();
    else if (G.phase === 'RESULT') { G.result === 'win' ? nextAfterWin() : retryWave(); }
    else if (G.phase === 'GAMEOVER') SF.menu.toMenu();
  }
  function onReset() {
    const G = SF.G;
    if (SF.ads.active()) return;
    if (G.phase === 'LOGIN') SF.menu.confirmLogin(true);          // 游客进入
    else if (G.phase === 'MENU') SF.menu.openSettings();
    else if (G.phase === 'MAP') return;
    else freshRun();                                               // 战局内：清档重来
  }

  let last = performance.now();
  function loop(now) {
    const G = SF.G;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    SF.ads.update(dt);
    SF.ui.tick(dt);
    if (!G.story && !SF.ads.active()) {
      if (G.phase === 'PREP') SF.forge.update(dt);
      else if (G.phase === 'BATTLE') SF.battle.update(dt);
      SF.fx.update(dt);
    }
    SF.render.draw();
    requestAnimationFrame(loop);
  }

  SF.main = { launch, startGame, freshRun, retryWave, nextAfterWin };

  SF.ui.bind(onFire, onReset);
  SF.input.bind();
  boot();
  requestAnimationFrame(loop);
})();
