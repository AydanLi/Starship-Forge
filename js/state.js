/* state.js — 数据层：运行时状态 G。所有模块共享读写的唯一状态对象。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const G = {
    phase: 'PREP',        // PREP | DEPLOY | BATTLE | RESULT | GAMEOVER
    // 熔炉
    current: null,        // {tier,x} 待投放件
    nextTier: 0,
    canDrop: false,
    over: false,
    // 进度
    score: 0, gold: 0, level: 0, wave: 0, bestTier: 0,
    // 编队
    slots: [null, null, null, null, null, null],
    bench: [],
    dragging: null,       // {tok, ox, oy, fromSlot}
    // 战斗
    pUnits: [], eUnits: [],
    pBuffs: null, pSyn: [],
    tacticalCd: 0, tacticalReady: false, battleTime: 0,
    result: '', bossName: '',
    // 剧情 / 广告 / 经济
    story: null, storyQueue: [],
    lastGain: 0, goldDoubled: true, overloadBoost: false
  };
  G.reset = function () {
    G.phase = 'PREP';
    G.current = null; G.canDrop = false; G.over = false;
    G.score = 0; G.gold = 0; G.level = 0; G.wave = 0; G.bestTier = 0;
    G.slots = [null, null, null, null, null, null]; G.bench = []; G.dragging = null;
    G.pUnits = []; G.eUnits = []; G.pBuffs = null; G.pSyn = [];
    G.tacticalCd = 0; G.tacticalReady = false; G.battleTime = 0; G.result = ''; G.bossName = '';
    G.story = null; G.storyQueue = [];
    G.lastGain = 0; G.goldDoubled = true; G.overloadBoost = false;
    G.nextTier = SF.util.pickDropTier();
  };
  SF.G = G;
})();
