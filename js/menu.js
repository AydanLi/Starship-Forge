/* menu.js — 系统层：登录 / 主界面 / 星图选关 / 系统设置。
   UI 命中区域集中定义在 SF.menu.UI（render 用同一份数据绘制，单一数据源）。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const { inRect } = SF.util;
  const W = 480;

  const UI = {
    // 主界面三按钮
    MBTN: {
      start: { x: W / 2 - 130, y: 392, w: 260, h: 56 },
      map:   { x: W / 2 - 130, y: 464, w: 260, h: 56 },
      set:   { x: W / 2 - 130, y: 536, w: 260, h: 56 }
    },
    // 设置面板行
    SET_PANEL: { x: 70, y: 240, w: 340, h: 320 },
    SET_ROWS: {
      sound:  { x: 90, y: 292, w: 300, h: 46 },
      wipe:   { x: 90, y: 352, w: 300, h: 46 },
      logout: { x: 90, y: 412, w: 300, h: 46 },
      close:  { x: 90, y: 484, w: 300, h: 46 }
    },
    // 星图节点（自下而上：启航点→五星区→新伊甸）；与剧情 SECTORS 一一对应
    NODES: [
      { x: 132, y: 596 }, { x: 330, y: 512 }, { x: 140, y: 428 }, { x: 330, y: 344 }, { x: 240, y: 252 }
    ],
    EDEN: { x: 240, y: 152 },
    NODE_R: 42
  };

  function uidInput() { return document.getElementById('uid'); }
  function showInput(show) { const el = uidInput(); if (el) { el.style.display = show ? 'block' : 'none'; if (show) { el.value = ''; setTimeout(() => el.focus(), 50); } } }

  function loadProfile() {
    const G = SF.G;
    const r = SF.save.load();
    G.level = 0; G.wave = 0; G.gold = 0; G.score = 0; G.bestTier = 0; G.maxLevel = 0;
    if (r && r.tampered) { SF.save.clear(); SF.ui.flashHint('⚠ 存档校验失败（疑似被修改），该账号进度已重置'); return; }
    if (r && r.data) { const d = r.data; G.level = d.level; G.wave = d.wave; G.gold = d.gold; G.score = d.score; G.bestTier = d.bestTier; G.maxLevel = d.maxLevel || d.level; }
  }

  SF.menu = {
    UI,
    maxUnlocked() { return Math.min(SF.G.maxLevel, 4); },

    toLogin() {
      const G = SF.G;
      G.phase = 'LOGIN'; G.panel = null; G.story = null; G.storyQueue = [];
      showInput(true);
      SF.ui.setHint('输入你的指挥官代号（2~12字），或以游客身份进入');
      SF.ui.update();
    },
    confirmLogin(asGuest) {
      const el = uidInput();
      if (asGuest) SF.user.guest();
      else if (!SF.user.login(el ? el.value : '')) { SF.ui.flashHint('代号需 2~12 个字符'); SF.audio.play('deny'); return; }
      showInput(false);
      SF.audio.play('coin');
      loadProfile();
      this.toMenu();
    },
    toMenu() {
      const G = SF.G;
      G.phase = 'MENU'; G.panel = null; G.story = null; G.storyQueue = [];
      showInput(false);
      SF.ui.setHint('欢迎回舰桥，指挥官 ' + (SF.user.name() || '') + ' · 星炉号待命中');
      SF.ui.update();
    },
    toMap() {
      const G = SF.G;
      G.phase = 'MAP'; G.panel = null;
      SF.audio.play('card');
      SF.ui.setHint('星图：点击已点亮的星区跳跃 · 灰色航道仍被封锁');
      SF.ui.update();
    },
    selectSector(i) {
      const G = SF.G;
      if (i > this.maxUnlocked()) { SF.ui.flashHint('航道封锁：需先打通前一个星区'); SF.audio.play('deny'); return; }
      G.level = i; G.wave = 0;
      SF.audio.play('deploy');
      SF.main.launch({ sectorCard: i });
    },
    openSettings() { SF.G.panel = 'settings'; SF.audio.play('card'); },
    closeSettings() { SF.G.panel = null; },

    /** 画布点击路由（LOGIN/MENU/MAP 阶段由 input.js 调进来） */
    click(px, py) {
      const G = SF.G;
      if (G.phase === 'LOGIN') return;   // 登录靠 DOM 按钮
      if (G.phase === 'MENU') {
        if (G.panel === 'settings') {
          const R = UI.SET_ROWS;
          if (inRect(px, py, R.sound)) { SF.audio.toggle(); return; }
          if (inRect(px, py, R.wipe)) { SF.save.clear(); loadProfile(); SF.ui.flashHint('本账号存档已清除'); SF.audio.play('deny'); return; }
          if (inRect(px, py, R.logout)) { SF.save.write(true); SF.user.logout(); this.toLogin(); return; }
          if (inRect(px, py, R.close)) { this.closeSettings(); return; }
          return;
        }
        if (inRect(px, py, UI.MBTN.start)) { SF.main.startGame(); return; }
        if (inRect(px, py, UI.MBTN.map)) { this.toMap(); return; }
        if (inRect(px, py, UI.MBTN.set)) { this.openSettings(); return; }
        return;
      }
      if (G.phase === 'MAP') {
        for (let i = 0; i < UI.NODES.length; i++) {
          const n = UI.NODES[i];
          if (Math.hypot(px - n.x, py - n.y) < UI.NODE_R) { this.selectSector(i); return; }
        }
      }
    }
  };
})();
