/* flow.ts — 装配层：流程控制/主循环步进/按钮语义（对应 web 原型的 main.js + ui.js 的语义部分）。
   视图层(GameApp)每帧调 flow.step(dt)，按钮通过 flow.onFire()/onReset()，
   按钮文案通过 flow.uiModel() 获取（替代 DOM 按钮）。 */
import { C } from './config';
import { G, resetG, setHint, flashHint, tickHint, PREP_HINT } from './state';
import { user } from './user';
import { save } from './save';
import { audio } from './audio';
import { fx } from './fx';
import { forge, bindUiDirty as forgeBind } from './forge';
import { board, bindUiDirty as boardBind } from './board';
import { battle, bindUiDirty as battleBind } from './battle';
import { econ, bindUiDirty as econBind, bindRetryWave } from './economy';
import { ads, bindUiDirty as adsBind } from './ads';
import { storySys, bindUiDirty as storyBind } from './story';
import { menu, bindUiDirty as menuBind, bindStartGame, bindLaunchSector } from './menu';
import { STORY } from './storyData';
import { pickDropTier } from './config';

function noop() {}

export function launch(opts?: { intro?: boolean, sectorCard?: number }): void {
  opts = opts || {};
  forge.reset(); fx.clear(); ads.reset();
  G.pUnits = []; G.eUnits = []; G.slots = [null, null, null, null, null, null]; G.bench = []; G.dragging = null;
  G.story = null; G.storyQueue = []; G.panel = null;
  G.lastGain = 0; G.goldDoubled = true; G.overloadBoost = false;
  G.phase = 'PREP'; G.over = false;
  G.nextTier = pickDropTier();
  forge.spawnCurrent();
  if (opts.intro) { setHint(PREP_HINT); storySys.queue(STORY.INTRO, STORY.SECTORS[0]); storySys.advance(); }
  else if (opts.sectorCard !== undefined) { setHint(PREP_HINT); storySys.queue(STORY.SECTORS[opts.sectorCard]); storySys.advance(); }
  else { setHint('星区 ' + (G.level + 1) + ' · 第 ' + (G.wave + 1) + ' 波 — ' + PREP_HINT); }
  save.write(true);
}
export function startGame(): void {
  if (G.level > 0 || G.wave > 0 || G.gold > 0 || G.score > 0) launch({});
  else launch({ intro: true });
}
export function freshRun(): void {
  save.clear();
  G.level = 0; G.wave = 0; G.gold = 0; G.score = 0; G.bestTier = 0; G.maxLevel = 0;
  launch({ intro: true });
}
export function toPrep(msg: string): void {
  G.pUnits = []; G.eUnits = [];
  G.slots = [null, null, null, null, null, null]; G.bench = [];
  G.phase = 'PREP';
  forge.spawnCurrent();
  setHint(msg);
  save.write(true);
}
export function nextAfterWin(): void {
  const wasBoss = G.wave === C.WAVES_PER_LEVEL - 1;
  if (wasBoss) { G.level++; G.wave = 0; G.maxLevel = Math.max(G.maxLevel, G.level); } else G.wave++;
  toPrep('备战：合成战舰，凑齐羁绊再「编队部署」');
  if (wasBoss) { if (G.level < STORY.SECTORS.length) storySys.queue(STORY.SECTORS[G.level]); else if (G.level === STORY.SECTORS.length) storySys.queue(STORY.ENDING); }
  else if (G.wave === C.WAVES_PER_LEVEL - 1) storySys.queue(storySys.bossCard(G.level));
  storySys.advance();
}
export function retryWave(): void { toPrep('备战：重整旗鼓，重新合成部署'); }

export function boot(): void {
  // 系统间回调接线（替代 web 版的 SF 全局查找）
  forgeBind(noop); boardBind(noop); battleBind(noop); econBind(noop); adsBind(noop); storyBind(noop); menuBind(noop);
  bindRetryWave(retryWave);
  bindStartGame(startGame);
  bindLaunchSector((i: number) => launch({ sectorCard: i }));
  resetG();
  if (user.uid()) { menu.loadProfile(); menu.toMenu(); }
  else menu.toLogin();
}

export function onFire(): void {
  if (ads.active()) return;
  if (G.story) { storySys.advance(); return; }
  if (G.phase === 'LOGIN') menu.confirmLogin(false);
  else if (G.phase === 'MENU') { if (G.panel) menu.closeSettings(); else startGame(); }
  else if (G.phase === 'MAP') menu.toMenu();
  else if (G.phase === 'PREP') board.enter();
  else if (G.phase === 'DEPLOY') battle.start();
  else if (G.phase === 'BATTLE') battle.tactical();
  else if (G.phase === 'RESULT') { G.result === 'win' ? nextAfterWin() : retryWave(); }
  else if (G.phase === 'GAMEOVER') menu.toMenu();
}
export function onReset(): void {
  if (ads.active()) return;
  if (G.phase === 'LOGIN') menu.confirmLogin(true);
  else if (G.phase === 'MENU') menu.openSettings();
  else if (G.phase === 'MAP') return;
  else freshRun();
}

/** 从进行中的对局返回主界面：先落盘当前进度（星区/波/金币/分数），再回主菜单。
    当前波次的熔炉/编队为临时状态，回主界面后「开始游戏」会从本波备战重新开始。 */
export function toMenu(): void {
  if (ads.active()) return;
  forge.reset(); fx.clear(); ads.reset();
  G.pUnits = []; G.eUnits = []; G.dragging = null;
  G.story = null; G.storyQueue = [];
  save.write(true);
  menu.toMenu();
}

export interface UiModel { fire: string, fireOn: boolean, reset: string, resetOn: boolean, hint: string }
export function uiModel(): UiModel {
  if (ads.active()) return { fire: '📺 广告播放中…', fireOn: false, reset: '—', resetOn: false, hint: G.hint };
  if (G.story) return { fire: '▶ ' + (G.story.btn || '继续'), fireOn: true, reset: '重新开始', resetOn: true, hint: G.hint };
  switch (G.phase as string) {
    case 'LOGIN': return { fire: '🚀 进入舰桥', fireOn: true, reset: '游客进入', resetOn: true, hint: G.hint };
    case 'MENU': return { fire: G.panel ? '关闭设置' : '▶ 开始游戏', fireOn: true, reset: '⚙ 系统设置', resetOn: true, hint: G.hint };
    case 'MAP': return { fire: '← 返回主界面', fireOn: true, reset: '—', resetOn: false, hint: G.hint };
    case 'PREP': { const n = forge.deployables().length; return { fire: '编队部署（' + n + '）', fireOn: n > 0, reset: '重新开始', resetOn: true, hint: G.hint }; }
    case 'DEPLOY': { const m = G.slots.filter(Boolean).length; return { fire: '⚔ 开战（' + m + '）', fireOn: m > 0, reset: '重新开始', resetOn: true, hint: G.hint }; }
    case 'BATTLE': return { fire: G.tacticalReady ? '⚡ 战术技·全体齐射' : '战术技冷却 ' + Math.ceil(G.tacticalCd) + 's', fireOn: G.tacticalReady, reset: '重新开始', resetOn: true, hint: G.hint };
    case 'RESULT': return G.result === 'win'
      ? { fire: (G.wave === C.WAVES_PER_LEVEL - 1 ? '进入下一星区 ▶' : '下一波 ▶'), fireOn: true, reset: '重新开始', resetOn: true, hint: G.hint }
      : { fire: '重试本波 ↻', fireOn: true, reset: '重新开始', resetOn: true, hint: G.hint };
    case 'GAMEOVER': return { fire: '返回主界面', fireOn: true, reset: '重新开始', resetOn: true, hint: G.hint };
  }
  return { fire: '—', fireOn: false, reset: '—', resetOn: false, hint: G.hint };
}

export function step(dt: number): void {
  ads.update(dt);
  tickHint(dt);
  if (!G.story && !ads.active()) {
    if (G.phase === 'PREP') forge.update(dt);
    else if (G.phase === 'BATTLE') battle.update(dt);
    fx.update(dt);
  }
}

// 视图层输入路由（对应 web 版 input.js）
export function pointerDown(px: number, py: number): void {
  audio.unlock();
  if (ads.active()) return;
  if (G.story) { storySys.advance(); return; }
  if (G.phase === 'LOGIN' || G.phase === 'MENU' || G.phase === 'MAP') { menu.click(px, py); return; }
  if (G.phase === 'RESULT') { econ.tryResultClick(px, py); return; }
  if (G.phase === 'PREP') {
    if (econ.tryPrepClick(px, py)) return;
    if (G.current) { G.current.x = px; forge.drop(); }
  } else if (G.phase === 'DEPLOY') board.dragStart(px, py);
}
export function pointerMove(px: number, py: number): void {
  if (G.phase === 'PREP' && G.current) G.current.x = px;
  else if (G.phase === 'DEPLOY') board.dragMove(px, py);
}
export function pointerUp(px: number, py: number): void {
  if (G.phase === 'DEPLOY') board.dragEnd(px, py);
}
export function pointerCancel(): void { board.cancelDrag(); }
