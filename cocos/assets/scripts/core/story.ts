/* story.ts — 剧情队列状态机（与 js/story.js 一致）。 */
import { G } from './state';
import { STORY } from './storyData';
import { audio } from './audio';

let uiDirty = () => {};
export function bindUiDirty(f: () => void) { uiDirty = f; }

export const storySys = {
  queue(...cards: any[]): void { for (const c of cards) if (c) G.storyQueue.push(c); },
  advance(): void { G.story = G.storyQueue.shift() || null; if (G.story) audio.play('card'); uiDirty(); },
  active(): boolean { return !!G.story; },
  bossCard(lv: number): any {
    const i = Math.min(lv, 4);
    return { tag: 'BOSS 来袭', title: STORY.BOSS_NAMES[i], color: '#ff3b5c', lines: ['「' + STORY.BOSS_NAMES[i] + '」：' + STORY.BOSS_TAUNT[i]] };
  }
};
