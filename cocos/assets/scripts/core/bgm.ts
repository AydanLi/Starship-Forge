/* bgm.ts — 背景音乐选曲逻辑（纯「状态 → 曲目 key」映射，零 cc 依赖；播放由 view/Bgm.ts 负责）。
   曲目文件位于 resources/audio/（即梦 AI 生成，见 docs/即梦背景音乐提示词.md 的生成记录）。 */
import { C } from './config';
import { G } from './state';
import { STORY } from './storyData';

export interface BgmPick { key: string, loop: boolean }

/** 全部曲目及循环属性：lose（失败短曲）与 ending（通关结局）单次播放，其余循环。 */
const LOOP: Record<string, boolean> = {
  bgm_menu: true,     // 登录 / 主界面 / 星图
  bgm_forge: true,    // 熔炉备战 / 编队部署
  bgm_battle: true,   // 普通自动战斗
  bgm_boss: true,     // Boss 战
  bgm_win: true,      // 胜利 / 结算
  bgm_story: true,    // 剧情卡衬底
  bgm_lose: false,    // 失败 / 熔炉过载（15s 短曲）
  bgm_ending: false   // 通关结局
};

export const BGM_KEYS: string[] = Object.keys(LOOP);

/** 根据当前游戏状态决定应播放的 BGM；返回 null 表示保持沉默。
    剧情卡优先于所在阶段（结局卡用专属终章曲）。 */
export function pickBgm(): BgmPick | null {
  let key: string;
  if (G.story) key = (G.story === STORY.ENDING) ? 'bgm_ending' : 'bgm_story';
  else switch (G.phase as string) {
    case 'LOGIN': case 'MENU': case 'MAP': key = 'bgm_menu'; break;
    case 'PREP': case 'DEPLOY': key = 'bgm_forge'; break;
    case 'BATTLE': key = (G.wave === C.WAVES_PER_LEVEL - 1) ? 'bgm_boss' : 'bgm_battle'; break;
    case 'RESULT': key = (G.result === 'win') ? 'bgm_win' : 'bgm_lose'; break;
    case 'GAMEOVER': key = 'bgm_lose'; break;
    default: return null;
  }
  return { key, loop: LOOP[key] };
}
