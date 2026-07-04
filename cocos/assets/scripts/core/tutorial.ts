/* tutorial.ts — 新手指引（轻量提示卡，核心三步：投放合成 → 编队拖拽 → 开战）。
   纯逻辑零 cc 依赖：视图层每帧调 tutorial.step(dt)，用 tutorial.current() 取当前提示卡绘制；
   点击任意处调 tutorial.tap()（不吞输入，玩家的这次点击照常生效）。
   完成后按 uid 持久化，二次进入不再出现；老玩家首次更新后也只会看到一轮。 */
import { platform } from './platform';
import { G } from './state';
import { forge } from './forge';
import { user } from './user';

const KEY = 'starforge_tut_v1:';

export interface TutTip {
  id: string;
  lines: string[];        // 提示文案（已按行拆好）
  x: number; y: number; w: number;   // 气泡框（游戏坐标，左上原点）
  arrowX: number; arrowY: number;    // 箭头尖端指向的位置（在气泡下方）
  }

const TIPS: TutTip[] = [
  {   // 箭头向上指向投放区（Y_DROP≈168）
    id: 'drop',
    lines: ['移动手指瞄准，点击屏幕投放零件', '相同零件相碰即合成升级', '合成到 5 级「攻击无人机」就能上阵'],
    x: 60, y: 282, w: 360, arrowX: 240, arrowY: 205,
  },
  {   // 箭头向下指向前排阵位（前排 y≈300，上缘 256）
    id: 'deploy',
    lines: ['把下方「待编区」的战舰拖进阵位', '前排扛伤 · 后排安心输出', '排好后点底部「编队完毕 · 开战」'],
    x: 60, y: 120, w: 360, arrowX: 240, arrowY: 254,
  },
  {   // 箭头向下指向底部「战术技」按钮
    id: 'battle',
    lines: ['战斗全自动进行，无需操作', '战况胶着时，点下方「战术技 · 全体齐射」', '打出全队群体爆发'],
    x: 60, y: 590, w: 360, arrowX: 149, arrowY: 742,
  },
];

let _done = false;          // 本 uid 已完成过引导
let _uidLoaded: string | null = null;
let _active: TutTip | null = null;
let _shown: { [id: string]: boolean } = {};
let _closeTimer = 0;        // 满足完成条件后延迟收起
let _battleAuto = 0;        // battle 卡自动收起计时

function flagKey(): string { return KEY + (user.uid() || '_'); }

function loadFlag(): void {
  const uid = user.uid();
  if (uid === _uidLoaded) return;
  _uidLoaded = uid;
  _done = platform.getItem(flagKey()) === '1';
  _shown = {}; _active = null;
}

function finishAll(): void {
  _done = true; _active = null;
  platform.setItem(flagKey(), '1');
}

function dismiss(): void {
  if (!_active) return;
  _active = null;
  if (_shown['drop'] && _shown['deploy'] && _shown['battle']) finishAll();
}

export const tutorial = {
  /** 每帧步进：触发/推进提示卡。视图层在 flow.step 之后调用。 */
  step(dt: number): void {
    loadFlag();
    if (_done || G.story) { if (G.story) _closeTimer = 0; return; }

    if (_active) {
      // 完成条件轮询 → 延迟 0.9s 自动收起（让玩家看到自己做对了）
      let satisfied = false;
      if (_active.id === 'drop') {
        let n = 0; for (const b of forge.bodies()) if (b.gTier !== undefined) n++;
        satisfied = n > 0;
      } else if (_active.id === 'deploy') {
        satisfied = G.slots.some((s: any) => !!s) || G.phase !== 'DEPLOY';
      } else if (_active.id === 'battle') {
        _battleAuto += dt;
        satisfied = _battleAuto > 7 || G.phase !== 'BATTLE';
      }
      if (satisfied) { _closeTimer += dt; if (_closeTimer > 0.9 || _active.id === 'battle') dismiss(); }
      else _closeTimer = 0;
      return;
    }

    // 触发新提示卡（仅第一次到达对应阶段时）
    if (G.phase === 'PREP' && !_shown['drop']) { _active = TIPS[0]; _shown['drop'] = true; _closeTimer = 0; }
    else if (G.phase === 'DEPLOY' && !_shown['deploy']) { _active = TIPS[1]; _shown['deploy'] = true; _closeTimer = 0; }
    else if (G.phase === 'BATTLE' && !_shown['battle']) { _active = TIPS[2]; _shown['battle'] = true; _battleAuto = 0; _closeTimer = 0; }
  },

  /** 当前要绘制的提示卡（无则 null） */
  current(): TutTip | null { return _done ? null : _active; },

  /** 玩家点击（不吞输入）：点哪都当作「知道了」 */
  tap(): void { if (_active) dismiss(); },

  /** 测试/调试用：清掉本 uid 的完成标记 */
  resetFlag(): void { platform.removeItem(flagKey()); _done = false; _shown = {}; _active = null; },
};
