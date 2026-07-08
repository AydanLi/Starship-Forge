/* state.ts — 运行时状态 G（与 web 原型 js/state.js 对应，phase 增加 LOGIN/MENU/MAP）。 */
import { pickDropTier } from './config';

export type Phase = 'LOGIN' | 'MENU' | 'MAP' | 'PREP' | 'DEPLOY' | 'BATTLE' | 'RESULT' | 'GAMEOVER';

export const G: any = {
  phase: 'LOGIN' as Phase,
  // 熔炉
  current: null as null | { tier: number, x: number },
  nextTier: 0, canDrop: false, over: false,
  // 进度
  score: 0, gold: 0, level: 0, wave: 0, bestTier: 0, maxLevel: 0, seed: 0,
  panel: null as null | 'settings',
  pendingName: '',          // 登录页正在输入的代号
  // 编队
  slots: [null, null, null, null, null, null] as any[],
  bench: [] as any[],
  dragging: null as any,
  // 战斗
  pUnits: [] as any[], eUnits: [] as any[],
  pBuffs: null as any, pSyn: [] as any[],
  tacticalCd: 0, tacticalReady: false, battleTime: 0,
  result: '', bossName: '',
  // 剧情 / 经济
  story: null as any, storyQueue: [] as any[],
  lastGain: 0, goldDoubled: true, overloadBoost: false,
  // 提示条（视图层读取）
  hint: '', hintTimer: 0
};

export function resetG(): void {
  G.phase = 'PREP';
  G.current = null; G.canDrop = false; G.over = false;
  G.score = 0; G.gold = 0; G.level = 0; G.wave = 0; G.bestTier = 0; G.maxLevel = 0; G.seed = 0; G.panel = null;
  G.slots = [null, null, null, null, null, null]; G.bench = []; G.dragging = null;
  G.pUnits = []; G.eUnits = []; G.pBuffs = null; G.pSyn = [];
  G.tacticalCd = 0; G.tacticalReady = false; G.battleTime = 0; G.result = ''; G.bossName = '';
  G.story = null; G.storyQueue = [];
  G.lastGain = 0; G.goldDoubled = true; G.overloadBoost = false;
  G.nextTier = pickDropTier();
}

export const PREP_HINT = '备战：合成战舰（5级起带阵营/舰种），凑齐羁绊再「编队部署」';
export function setHint(t: string): void { G.hint = t; G.hintTimer = 0; }
export function flashHint(t: string): void { G.hint = t; G.hintTimer = 2; }
export function tickHint(dt: number): void {
  if (G.hintTimer > 0) { G.hintTimer -= dt; if (G.hintTimer <= 0 && G.phase === 'PREP') G.h