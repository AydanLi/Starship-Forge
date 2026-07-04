/* menu.ts — 登录/主界面/星图/设置（与 js/menu.js 一致；文本输入走 platform.textInput）。 */
import { W, inRect } from './config';
import { G, setHint, flashHint } from './state';
import { user } from './user';
import { save } from './save';
import { audio } from './audio';
import { platform } from './platform';
import { tutorial } from './tutorial';

let uiDirty = () => {};
let startGameFn = () => {};
let launchSectorFn = (_i: number) => {};
export function bindUiDirty(f: () => void) { uiDirty = f; }
export function bindStartGame(f: () => void) { startGameFn = f; }
export function bindLaunchSector(f: (i: number) => void) { launchSectorFn = f; }

export const MENU_UI = {
  MBTN: {
    start: { x: W / 2 - 130, y: 392, w: 260, h: 56 },
    map:   { x: W / 2 - 130, y: 464, w: 260, h: 56 },
    set:   { x: W / 2 - 130, y: 536, w: 260, h: 56 }
  },
  SET_PANEL: { x: 70, y: 240, w: 340, h: 320 },
  SET_ROWS: {
    sound:  { x: 90, y: 292, w: 300, h: 46 },
    wipe:   { x: 90, y: 352, w: 300, h: 46 },
    logout: { x: 90, y: 412, w: 300, h: 46 },
    close:  { x: 90, y: 484, w: 300, h: 46 }
  },
  NODES: [
    { x: 132, y: 596 }, { x: 330, y: 512 }, { x: 140, y: 428 }, { x: 330, y: 344 }, { x: 240, y: 252 }
  ],
  EDEN: { x: 240, y: 152 },
  NODE_R: 42,
  LOGIN_BOX: { x: 90, y: 348, w: 300, h: 48 }   // 登录页“输入代号”点击区
};

function loadProfile(): void {
  const r = save.load();
  G.level = 0; G.wave = 0; G.gold = 0; G.score = 0; G.bestTier = 0; G.maxLevel = 0;
  if (r && r.tampered) { save.clear(); flashHint('⚠ 存档校验失败（疑似被修改），该账号进度已重置'); return; }
  if (r && r.data) { const d = r.data; G.level = d.level; G.wave = d.wave; G.gold = d.gold; G.score = d.score; G.bestTier = d.bestTier; G.maxLevel = d.maxLevel || d.level; }
}

export const menu = {
  UI: MENU_UI,
  maxUnlocked(): number { return Math.min(G.maxLevel, 4); },

  toLogin(): void {
    G.phase = 'LOGIN'; G.panel = null; G.story = null; G.storyQueue = []; G.pendingName = '';
    setHint('点击输入框填写指挥官代号（2~12字），或以游客身份进入');
    uiDirty();
  },
  editName(): void {   // 点击登录输入框 → 平台键盘/浏览器 prompt
    platform.textInput(G.pendingName, v => { G.pendingName = String(v || '').slice(0, 12); uiDirty(); });
  },
  confirmLogin(asGuest: boolean): void {
    if (asGuest) user.guest();
    else if (!user.login(G.pendingName)) { flashHint('代号需 2~12 个字符（点击输入框填写）'); audio.play('deny'); return; }
    audio.play('coin');
    loadProfile();
    this.toMenu();
  },
  toMenu(): void {
    G.phase = 'MENU'; G.panel = null; G.story = null; G.storyQueue = [];
    setHint('欢迎回舰桥，指挥官 ' + (user.name() || '') + ' · 星炉号待命中');
    uiDirty();
  },
  toMap(): void {
    G.phase = 'MAP'; G.panel = null;
    audio.play('card');
    setHint('星图：点击已点亮的星区跳跃 · 灰色航道仍被封锁');
    uiDirty();
  },
  selectSector(i: number): void {
    if (i > this.maxUnlocked()) { flashHint('航道封锁：需先打通前一个星区'); audio.play('deny'); return; }
    G.level = i; G.wave = 0;
    audio.play('deploy');
    launchSectorFn(i);
  },
  openSettings(): void { G.panel = 'settings'; audio.play('card'); uiDirty(); },
  closeSettings(): void { G.panel = null; uiDirty(); },
  loadProfile,

  click(px: number, py: number): void {
    if (G.phase === 'LOGIN') {
      if (inRect(px, py, MENU_UI.LOGIN_BOX)) this.editName();
      return;
    }
    if (G.phase === 'MENU') {
      if (G.panel === 'settings') {
        const R = MENU_UI.SET_ROWS;
        if (inRect(px, py, R.sound)) { audio.toggle(); uiDirty(); return; }
        if (inRect(px, py, R.wipe)) { save.clear(); tutorial.resetFlag(); loadProfile(); flashHint('本账号存档已清除（新手指引将重新出现）'); audio.play('deny'); return; }
        if (inRect(px, py, R.logout)) { save.write(true); user.logout(); this.toLogin(); return; }
        if (inRect(px, py, R.close)) { this.closeSettings(); return; }
        return;
      }
      if (inRect(px, py, MENU_UI.MBTN.start)) { startGameFn(); return; }
      if (inRect(px, py, MENU_UI.MBTN.map)) { this.toMap(); return; }
      if (inRect(px, py, MENU_UI.MBTN.set)) { this.openSettings(); return; }
      return;
    }
    if (G.phase === 'MAP') {
      for (let i = 0; i < MENU_UI.NODES.length; i++) {
        const n = MENU_UI.NODES[i];
        if (Math.hypot(px - n.x, py - n.y) < MENU_UI.NODE_R) { this.selectSector(i); return; }
      }
    }
  }
};
